import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ServiceProtocol, ServiceProtocolTechnician, ServiceProtocolHistory } from '../data/entities'
import { createTechnicianSchema, updateTechnicianSchema, deleteTechnicianSchema } from '../data/validators'
import { ensureScope } from './protocols'
import { emitProtocolEvent } from '../events'

const EDITABLE_STATUSES = ['draft', 'in_review']

// --- create ---

export const createTechnicianCommand: CommandHandler<Record<string, unknown>, ServiceProtocolTechnician> = {
  id: 'service_protocols.technicians.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createTechnicianSchema.parse(rawInput)
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
    if (!EDITABLE_STATUSES.includes(protocol.status)) {
      throw new CrudHttpError(422, { error: `Cannot add technician to protocol with status '${protocol.status}'` })
    }

    const existing = await em.findOne(ServiceProtocolTechnician, {
      protocol: { id: parsed.protocol_id },
      staffMemberId: parsed.staff_member_id,
      deletedAt: null,
    } as FilterQuery<ServiceProtocolTechnician>)
    if (existing) {
      throw new CrudHttpError(422, { error: 'This technician is already on the protocol' })
    }

    const technician = await de.createOrmEntity({
      entity: ServiceProtocolTechnician,
      data: {
        protocol,
        staffMemberId: parsed.staff_member_id,
        dateFrom: parsed.date_from ?? null,
        dateTo: parsed.date_to ?? null,
        hoursWorked: 0,
        isBillable: false,
        kmDriven: 0,
        kmIsBillable: false,
        delegationDays: 0,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'technician_added' as const,
        newValue: { staffMemberId: parsed.staff_member_id },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return technician
  },
}

// --- update ---

export const updateTechnicianCommand: CommandHandler<Record<string, unknown>, ServiceProtocolTechnician> = {
  id: 'service_protocols.technicians.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = updateTechnicianSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocolTechnician, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocolTechnician>)
    if (!existing) throw new CrudHttpError(404, { error: 'Technician line not found' })

    const protocol = await em.findOne(ServiceProtocol, {
      id: typeof existing.protocol === 'string' ? existing.protocol : existing.protocol.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (protocol.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot edit technician on a closed protocol' })
    }

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false

    // Coordinator-only fields check
    const hasBillingFields = [
      parsed.is_billable,
      parsed.km_is_billable,
      parsed.hourly_rate_snapshot,
      parsed.km_rate_snapshot,
      parsed.diet_rate_snapshot,
    ].some((v) => v !== undefined)

    if (hasBillingFields && !isCoordinator) {
      throw new CrudHttpError(403, { error: 'Coordinator permission required to edit billing fields' })
    }

    const technician = await de.updateOrmEntity({
      entity: ServiceProtocolTechnician,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ServiceProtocolTechnician>,
      apply: (e) => {
        if (parsed.date_from !== undefined) e.dateFrom = parsed.date_from
        if (parsed.date_to !== undefined) e.dateTo = parsed.date_to
        if (parsed.hours_worked !== undefined) e.hoursWorked = parsed.hours_worked
        if (parsed.km_driven !== undefined) e.kmDriven = parsed.km_driven
        if (parsed.delegation_days !== undefined) e.delegationDays = parsed.delegation_days
        if (parsed.delegation_country !== undefined) e.delegationCountry = parsed.delegation_country
        if (parsed.hotel_invoice_ref !== undefined) e.hotelInvoiceRef = parsed.hotel_invoice_ref
        if (parsed.hotel_amount !== undefined) e.hotelAmount = parsed.hotel_amount
        // Coordinator-only
        if (isCoordinator) {
          if (parsed.is_billable !== undefined) e.isBillable = parsed.is_billable
          if (parsed.km_is_billable !== undefined) e.kmIsBillable = parsed.km_is_billable
          if (parsed.hourly_rate_snapshot !== undefined) e.hourlyRateSnapshot = parsed.hourly_rate_snapshot
          if (parsed.km_rate_snapshot !== undefined) e.kmRateSnapshot = parsed.km_rate_snapshot
          if (parsed.diet_rate_snapshot !== undefined) e.dietRateSnapshot = parsed.diet_rate_snapshot
        }
      },
    })
    if (!technician) throw new CrudHttpError(404, { error: 'Technician line not found' })

    const protocolRef = protocol

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol: protocolRef,
        eventType: 'technician_added' as const,
        newValue: { technicianId: parsed.id, updatedFields: Object.keys(parsed).filter((k) => k !== 'id') },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.technician.updated', {
      id: String(technician.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return technician
  },
}

// --- delete ---

export const deleteTechnicianCommand: CommandHandler<Record<string, unknown>, ServiceProtocolTechnician> = {
  id: 'service_protocols.technicians.delete',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = deleteTechnicianSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocolTechnician, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocolTechnician>)
    if (!existing) throw new CrudHttpError(404, { error: 'Technician line not found' })

    const protocolId = typeof existing.protocol === 'string' ? existing.protocol : existing.protocol.id

    const protocol = await em.findOne(ServiceProtocol, {
      id: protocolId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (protocol.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot remove technician from a closed protocol' })
    }

    // Ensure at least one technician remains
    const count = await em.count(ServiceProtocolTechnician, {
      protocol: { id: protocolId },
      deletedAt: null,
    } as FilterQuery<ServiceProtocolTechnician>)

    if (count <= 1) {
      throw new CrudHttpError(422, { error: 'Cannot remove the last technician from a protocol' })
    }

    const technician = await de.deleteOrmEntity({
      entity: ServiceProtocolTechnician,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<ServiceProtocolTechnician>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!technician) throw new CrudHttpError(404, { error: 'Technician line not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'technician_removed' as const,
        oldValue: { staffMemberId: existing.staffMemberId },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return technician
  },
}

registerCommand(createTechnicianCommand)
registerCommand(updateTechnicianCommand)
registerCommand(deleteTechnicianCommand)
