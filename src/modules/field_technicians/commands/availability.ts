import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { FieldTechnicianAvailability } from '../data/entities'
import {
  fieldTechnicianAvailabilityCreateSchema,
  fieldTechnicianAvailabilityUpdateSchema,
  type FieldTechnicianAvailabilityCreateInput,
  type FieldTechnicianAvailabilityUpdateInput,
} from '../data/validators'
import { fieldTechnicianAvailabilityCrudEvents, FIELD_TECHNICIAN_AVAILABILITY_ENTITY_TYPE } from '../lib/crud'

const availabilityCrudIndexer: CrudIndexerConfig<FieldTechnicianAvailability> = {
  entityType: FIELD_TECHNICIAN_AVAILABILITY_ENTITY_TYPE,
}

const createAvailabilityCommand: CommandHandler<FieldTechnicianAvailabilityCreateInput, { availabilityId: string }> = {
  id: 'field_technicians.availability.create',
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianAvailabilityCreateSchema.parse(rawInput)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(FieldTechnicianAvailability, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      technicianId: parsed.technicianId,
      date: parsed.date,
      dayType: parsed.dayType ?? 'work_day',
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(record)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: fieldTechnicianAvailabilityCrudEvents,
      indexer: availabilityCrudIndexer,
    })

    return { availabilityId: record.id }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.availability.create', 'Add availability record'),
      resourceKind: 'field_technicians.availability',
      resourceId: result.availabilityId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

const updateAvailabilityCommand: CommandHandler<FieldTechnicianAvailabilityUpdateInput, { availabilityId: string }> = {
  id: 'field_technicians.availability.update',
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianAvailabilityUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      FieldTechnicianAvailability,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Availability record not found.' })

    if (parsed.dayType !== undefined) record.dayType = parsed.dayType
    if (parsed.notes !== undefined) record.notes = parsed.notes ?? null
    record.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: fieldTechnicianAvailabilityCrudEvents,
      indexer: availabilityCrudIndexer,
    })

    return { availabilityId: record.id }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.availability.update', 'Update availability record'),
      resourceKind: 'field_technicians.availability',
      resourceId: result.availabilityId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

const deleteAvailabilityCommand: CommandHandler<{ id?: string }, { availabilityId: string }> = {
  id: 'field_technicians.availability.delete',
  async execute(input, ctx) {
    const id = input?.id
    if (!id) throw new CrudHttpError(400, { error: 'Availability record id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      FieldTechnicianAvailability,
      { id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Availability record not found.' })

    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: fieldTechnicianAvailabilityCrudEvents,
      indexer: availabilityCrudIndexer,
    })

    return { availabilityId: record.id }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.availability.delete', 'Remove availability record'),
      resourceKind: 'field_technicians.availability',
      resourceId: result.availabilityId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

registerCommand(createAvailabilityCommand)
registerCommand(updateAvailabilityCommand)
registerCommand(deleteAvailabilityCommand)
