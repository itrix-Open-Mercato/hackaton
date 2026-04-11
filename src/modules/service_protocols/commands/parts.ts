import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ServiceProtocol, ServiceProtocolPart, ServiceProtocolHistory } from '../data/entities'
import { createPartSchema, updatePartSchema, deletePartSchema } from '../data/validators'
import { ensureScope } from './protocols'
import { emitProtocolEvent } from '../events'

// --- create ---

export const createPartCommand: CommandHandler<Record<string, unknown>, ServiceProtocolPart> = {
  id: 'service_protocols.parts.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createPartSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const protocol = await em.findOne(ServiceProtocol, {
      id: parsed.protocol_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (protocol.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot add parts to a closed protocol' })
    }

    // Coordinator-only billing fields
    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    if ((parsed.is_billable || parsed.unit_price_snapshot != null) && !isCoordinator) {
      throw new CrudHttpError(403, { error: 'Coordinator permission required to set billing fields' })
    }

    const part = await de.createOrmEntity({
      entity: ServiceProtocolPart,
      data: {
        protocol,
        catalogProductId: parsed.catalog_product_id ?? null,
        nameSnapshot: parsed.name_snapshot,
        partCodeSnapshot: parsed.part_code_snapshot ?? null,
        quantityProposed: parsed.quantity_proposed ?? 0,
        quantityUsed: parsed.quantity_used ?? 0,
        unit: parsed.unit ?? null,
        unitPriceSnapshot: parsed.unit_price_snapshot ?? null,
        isBillable: isCoordinator ? (parsed.is_billable ?? false) : false,
        lineStatus: parsed.line_status ?? 'added',
        notes: parsed.notes ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'part_changed' as const,
        newValue: { action: 'added', partId: part.id, name: parsed.name_snapshot },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return part
  },
}

// --- update ---

export const updatePartCommand: CommandHandler<Record<string, unknown>, ServiceProtocolPart> = {
  id: 'service_protocols.parts.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = updatePartSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocolPart, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocolPart>)
    if (!existing) throw new CrudHttpError(404, { error: 'Part line not found' })

    const protocolId = typeof existing.protocol === 'string' ? existing.protocol : existing.protocol.id
    const protocol = await em.findOne(ServiceProtocol, {
      id: protocolId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (protocol.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot edit parts of a closed protocol' })
    }

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    const hasBillingFields = parsed.is_billable !== undefined || parsed.unit_price_snapshot !== undefined
    if (hasBillingFields && !isCoordinator) {
      throw new CrudHttpError(403, { error: 'Coordinator permission required to edit billing fields' })
    }

    const part = await de.updateOrmEntity({
      entity: ServiceProtocolPart,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ServiceProtocolPart>,
      apply: (e) => {
        if (parsed.quantity_used !== undefined) {
          e.quantityUsed = parsed.quantity_used
          // Auto-set removed when quantity_used = 0 and line was proposed
          if (parsed.quantity_used === 0 && e.lineStatus === 'proposed' && parsed.line_status === undefined) {
            e.lineStatus = 'removed'
          }
        }
        if (parsed.line_status !== undefined) e.lineStatus = parsed.line_status
        if (parsed.notes !== undefined) e.notes = parsed.notes
        if (isCoordinator) {
          if (parsed.is_billable !== undefined) e.isBillable = parsed.is_billable
          if (parsed.unit_price_snapshot !== undefined) e.unitPriceSnapshot = parsed.unit_price_snapshot
        }
      },
    })
    if (!part) throw new CrudHttpError(404, { error: 'Part line not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'part_changed' as const,
        newValue: { action: 'updated', partId: parsed.id, updatedFields: Object.keys(parsed).filter((k) => k !== 'id') },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.part.updated', {
      id: String(part.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return part
  },
}

// --- delete ---

export const deletePartCommand: CommandHandler<Record<string, unknown>, ServiceProtocolPart> = {
  id: 'service_protocols.parts.delete',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = deletePartSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocolPart, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocolPart>)
    if (!existing) throw new CrudHttpError(404, { error: 'Part line not found' })

    const protocolId = typeof existing.protocol === 'string' ? existing.protocol : existing.protocol.id
    const protocol = await em.findOne(ServiceProtocol, {
      id: protocolId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (protocol.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot delete parts of a closed protocol' })
    }

    // For proposed lines, prefer marking as removed instead of deleting
    if (existing.lineStatus === 'proposed') {
      const part = await de.updateOrmEntity({
        entity: ServiceProtocolPart,
        where: {
          id: parsed.id,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        } as FilterQuery<ServiceProtocolPart>,
        apply: (e) => { e.lineStatus = 'removed' },
      })

      await de.createOrmEntity({
        entity: ServiceProtocolHistory,
        data: {
          protocol,
          eventType: 'part_changed' as const,
          oldValue: { action: 'removed', partId: parsed.id },
          newValue: { lineStatus: 'removed' },
          performedByUserId: ctx.auth?.userId ?? null,
          performedAt: new Date(),
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        },
      })

      return part!
    }

    // For added/confirmed/removed lines, soft delete
    const part = await de.deleteOrmEntity({
      entity: ServiceProtocolPart,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<ServiceProtocolPart>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!part) throw new CrudHttpError(404, { error: 'Part line not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'part_changed' as const,
        oldValue: { action: 'deleted', partId: parsed.id },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return part
  },
}

registerCommand(createPartCommand)
registerCommand(updatePartCommand)
registerCommand(deletePartCommand)
