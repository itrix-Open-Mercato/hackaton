import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { Technician, TechnicianSkill, TechnicianCertification } from '../data/entities'
import { technicianCreateSchema, technicianUpdateSchema } from '../data/validators'
import { ENTITY_TYPE } from '../lib/constants'

export const technicianCrudEvents: CrudEventsConfig<Technician> = {
  module: 'technicians',
  entity: 'technician',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Technician>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const technicianCrudIndexer: CrudIndexerConfig<Technician> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Technician>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Technician>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

export const createTechnicianCommand: CommandHandler<Record<string, unknown>, Technician> = {
  id: 'technicians.technicians.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = technicianCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(Technician, {
      staffMemberId: parsed.staff_member_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)
    if (existing) throw new CrudHttpError(409, { error: 'A technician profile already exists for this staff member' })

    const technician = await de.createOrmEntity({
      entity: Technician,
      data: {
        staffMemberId: parsed.staff_member_id,
        isActive: parsed.is_active,
        displayName: parsed.display_name ?? null,
        firstName: parsed.first_name ?? null,
        lastName: parsed.last_name ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        locationStatus: parsed.location_status ?? 'in_office',
        languages: parsed.languages ?? [],
        vehicleId: parsed.vehicle_id ?? null,
        vehicleLabel: parsed.vehicle_label ?? null,
        currentOrderId: parsed.current_order_id ?? null,
        notes: parsed.notes ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    if (parsed.skills?.length) {
      const uniqueSkills = [...new Set(parsed.skills)]
      for (const name of uniqueSkills) {
        await de.createOrmEntity({
          entity: TechnicianSkill,
          data: {
            technician,
            name,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
          },
        })
      }
    }

    if (parsed.certifications?.length) {
      for (const cert of parsed.certifications) {
        await de.createOrmEntity({
          entity: TechnicianCertification,
          data: {
            technician,
            name: cert.name,
            certType: cert.cert_type ?? null,
            certificateNumber: cert.certificate_number ?? null,
            code: cert.code ?? null,
            issuedAt: cert.issued_at ? new Date(cert.issued_at) : null,
            expiresAt: cert.expires_at ? new Date(cert.expires_at) : null,
            issuedBy: cert.issued_by ?? null,
            notes: cert.notes ?? null,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
          },
        })
      }
    }

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: technician,
      identifiers: {
        id: String(technician.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: technicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return technician
  },
}

export const updateTechnicianCommand: CommandHandler<Record<string, unknown>, Technician> = {
  id: 'technicians.technicians.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = technicianUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const technician = await de.updateOrmEntity({
      entity: Technician,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Technician>,
      apply: (entity) => {
        if (parsed.is_active !== undefined) entity.isActive = parsed.is_active
        if (parsed.display_name !== undefined) entity.displayName = parsed.display_name
        if (parsed.first_name !== undefined) entity.firstName = parsed.first_name
        if (parsed.last_name !== undefined) entity.lastName = parsed.last_name
        if (parsed.email !== undefined) entity.email = parsed.email
        if (parsed.phone !== undefined) entity.phone = parsed.phone
        if (parsed.location_status !== undefined) entity.locationStatus = parsed.location_status
        if (parsed.languages !== undefined) entity.languages = parsed.languages
        if (parsed.vehicle_id !== undefined) entity.vehicleId = parsed.vehicle_id
        if (parsed.vehicle_label !== undefined) entity.vehicleLabel = parsed.vehicle_label
        if (parsed.current_order_id !== undefined) entity.currentOrderId = parsed.current_order_id
        if (parsed.notes !== undefined) entity.notes = parsed.notes
      },
    })
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: technician,
      identifiers: {
        id: String(technician.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: technicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return technician
  },
}

export const deleteTechnicianCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Technician> = {
  id: 'technicians.technicians.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Technician id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const technician = await de.deleteOrmEntity({
      entity: Technician,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Technician>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: technician,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: technicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return technician
  },
}

registerCommand(createTechnicianCommand)
registerCommand(updateTechnicianCommand)
registerCommand(deleteTechnicianCommand)
