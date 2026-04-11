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
            certificateNumber: cert.certificate_number ?? null,
            issuedAt: cert.issued_at ? new Date(cert.issued_at) : null,
            expiresAt: cert.expires_at ? new Date(cert.expires_at) : null,
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
