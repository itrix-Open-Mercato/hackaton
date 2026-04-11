import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { buildChanges, emitCrudSideEffects, emitCrudUndoSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { FieldTechnician } from '../data/entities'
import {
  fieldTechnicianCreateSchema,
  fieldTechnicianUpdateSchema,
  type FieldTechnicianCreateInput,
  type FieldTechnicianUpdateInput,
} from '../data/validators'
import { fieldTechnicianCrudEvents, FIELD_TECHNICIAN_ENTITY_TYPE } from '../lib/crud'

const technicianCrudIndexer: CrudIndexerConfig<FieldTechnician> = {
  entityType: FIELD_TECHNICIAN_ENTITY_TYPE,
}

type TechnicianSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  displayName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  locationStatus: string
  skills: string[]
  languages: string[]
  notes: string | null
  staffMemberId: string | null
  vehicleId: string | null
  vehicleLabel: string | null
  currentOrderId: string | null
  isActive: boolean
  deletedAt: string | null
}

type TechnicianUndoPayload = {
  before?: TechnicianSnapshot | null
  after?: TechnicianSnapshot | null
}

async function loadTechnicianSnapshot(em: EntityManager, id: string): Promise<TechnicianSnapshot | null> {
  const technician = await findOneWithDecryption(em, FieldTechnician, { id }, undefined, { tenantId: null, organizationId: null })
  if (!technician) return null
  return {
    id: technician.id,
    tenantId: technician.tenantId,
    organizationId: technician.organizationId,
    displayName: technician.displayName,
    firstName: technician.firstName ?? null,
    lastName: technician.lastName ?? null,
    email: technician.email ?? null,
    phone: technician.phone ?? null,
    locationStatus: technician.locationStatus,
    skills: technician.skills ?? [],
    languages: technician.languages ?? [],
    notes: technician.notes ?? null,
    staffMemberId: technician.staffMemberId ?? null,
    vehicleId: technician.vehicleId ?? null,
    vehicleLabel: technician.vehicleLabel ?? null,
    currentOrderId: technician.currentOrderId ?? null,
    isActive: technician.isActive ?? true,
    deletedAt: technician.deletedAt ? technician.deletedAt.toISOString() : null,
  }
}

const createTechnicianCommand: CommandHandler<FieldTechnicianCreateInput, { technicianId: string }> = {
  id: 'field_technicians.technicians.create',
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianCreateSchema.parse(rawInput)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const technician = em.create(FieldTechnician, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      displayName: parsed.displayName,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      locationStatus: parsed.locationStatus ?? 'in_office',
      skills: (parsed.skills ?? []).map((s: string) => s.toLowerCase().trim()),
      languages: (parsed.languages ?? []).map((s: string) => s.toLowerCase().trim()),
      notes: parsed.notes ?? null,
      staffMemberId: parsed.staffMemberId ?? null,
      vehicleId: parsed.vehicleId ?? null,
      vehicleLabel: parsed.vehicleLabel ?? null,
      currentOrderId: parsed.currentOrderId ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(technician)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: technician,
      identifiers: {
        id: technician.id,
        organizationId: technician.organizationId,
        tenantId: technician.tenantId,
      },
      events: fieldTechnicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return { technicianId: technician.id }
  },
  buildLog: async ({ result, ctx }) => {
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadTechnicianSnapshot(em.fork(), result.technicianId)
    if (!snapshot) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.create', 'Create technician'),
      resourceKind: 'field_technicians.field_technician',
      resourceId: snapshot.id,
      tenantId: snapshot.tenantId,
      organizationId: snapshot.organizationId,
      snapshotAfter: snapshot,
      payload: { undo: { after: snapshot } satisfies TechnicianUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as TechnicianUndoPayload | undefined
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const technician = await em.findOne(FieldTechnician, { id: after.id })
    if (technician) {
      technician.deletedAt = new Date()
      await em.flush()

      const de = ctx.container.resolve('dataEngine') as DataEngine
      await emitCrudUndoSideEffects({
        dataEngine: de,
        action: 'deleted',
        entity: technician,
        identifiers: { id: technician.id, organizationId: technician.organizationId, tenantId: technician.tenantId },
        events: fieldTechnicianCrudEvents,
        indexer: technicianCrudIndexer,
      })
    }
  },
}

const updateTechnicianCommand: CommandHandler<FieldTechnicianUpdateInput, { technicianId: string }> = {
  id: 'field_technicians.technicians.update',
  async prepare(rawInput, ctx) {
    const parsed = fieldTechnicianUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadTechnicianSnapshot(em, parsed.id)
    if (!snapshot) return {}
    return { before: snapshot }
  },
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const technician = await findOneWithDecryption(
      em,
      FieldTechnician,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found.' })

    if (parsed.displayName !== undefined) technician.displayName = parsed.displayName
    if (parsed.firstName !== undefined) technician.firstName = parsed.firstName ?? null
    if (parsed.lastName !== undefined) technician.lastName = parsed.lastName ?? null
    if (parsed.email !== undefined) technician.email = parsed.email ?? null
    if (parsed.phone !== undefined) technician.phone = parsed.phone ?? null
    if (parsed.locationStatus !== undefined) technician.locationStatus = parsed.locationStatus
    if (parsed.skills !== undefined) technician.skills = parsed.skills.map((s: string) => s.toLowerCase().trim())
    if (parsed.languages !== undefined) technician.languages = parsed.languages.map((s: string) => s.toLowerCase().trim())
    if (parsed.notes !== undefined) technician.notes = parsed.notes ?? null
    if (parsed.staffMemberId !== undefined) technician.staffMemberId = parsed.staffMemberId ?? null
    if (parsed.vehicleId !== undefined) technician.vehicleId = parsed.vehicleId ?? null
    if (parsed.vehicleLabel !== undefined) technician.vehicleLabel = parsed.vehicleLabel ?? null
    if (parsed.currentOrderId !== undefined) technician.currentOrderId = parsed.currentOrderId ?? null
    if (parsed.isActive !== undefined) technician.isActive = parsed.isActive
    technician.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: technician,
      identifiers: { id: technician.id, organizationId: technician.organizationId, tenantId: technician.tenantId },
      events: fieldTechnicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return { technicianId: technician.id }
  },
  buildLog: async ({ snapshots, ctx }) => {
    const before = snapshots.before as TechnicianSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadTechnicianSnapshot(em, before.id)
    if (!after) return null
    const changes = buildChanges(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      ['displayName', 'firstName', 'lastName', 'email', 'phone', 'locationStatus', 'skills', 'languages', 'notes', 'isActive'],
    )
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.update', 'Update technician'),
      resourceKind: 'field_technicians.field_technician',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      changes,
      payload: { undo: { before, after } satisfies TechnicianUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as TechnicianUndoPayload | undefined
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const technician = await em.findOne(FieldTechnician, { id: before.id })
    if (!technician) return
    technician.displayName = before.displayName
    technician.firstName = before.firstName ?? null
    technician.lastName = before.lastName ?? null
    technician.email = before.email ?? null
    technician.phone = before.phone ?? null
    technician.locationStatus = before.locationStatus as FieldTechnician['locationStatus']
    technician.skills = before.skills
    technician.languages = before.languages
    technician.notes = before.notes ?? null
    technician.isActive = before.isActive
    technician.deletedAt = before.deletedAt ? new Date(before.deletedAt) : null
    technician.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: technician,
      identifiers: { id: technician.id, organizationId: technician.organizationId, tenantId: technician.tenantId },
      events: fieldTechnicianCrudEvents,
      indexer: technicianCrudIndexer,
    })
  },
}

const deleteTechnicianCommand: CommandHandler<{ id?: string }, { technicianId: string }> = {
  id: 'field_technicians.technicians.delete',
  async prepare(input, ctx) {
    const id = input?.id
    if (!id) throw new CrudHttpError(400, { error: 'Technician id is required.' })
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadTechnicianSnapshot(em, id)
    if (!snapshot) return {}
    return { before: snapshot }
  },
  async execute(input, ctx) {
    const id = input?.id
    if (!id) throw new CrudHttpError(400, { error: 'Technician id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const technician = await findOneWithDecryption(
      em,
      FieldTechnician,
      { id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found.' })

    technician.deletedAt = new Date()
    technician.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: technician,
      identifiers: { id: technician.id, organizationId: technician.organizationId, tenantId: technician.tenantId },
      events: fieldTechnicianCrudEvents,
      indexer: technicianCrudIndexer,
    })

    return { technicianId: technician.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as TechnicianSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.delete', 'Delete technician'),
      resourceKind: 'field_technicians.field_technician',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies TechnicianUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as TechnicianUndoPayload | undefined
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let technician = await em.findOne(FieldTechnician, { id: before.id })
    if (!technician) {
      technician = em.create(FieldTechnician, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        displayName: before.displayName,
        firstName: before.firstName ?? null,
        lastName: before.lastName ?? null,
        email: before.email ?? null,
        phone: before.phone ?? null,
        locationStatus: before.locationStatus as FieldTechnician['locationStatus'],
        skills: before.skills,
        languages: before.languages,
        notes: before.notes ?? null,
        staffMemberId: before.staffMemberId ?? null,
        vehicleId: before.vehicleId ?? null,
        vehicleLabel: before.vehicleLabel ?? null,
        currentOrderId: before.currentOrderId ?? null,
        isActive: before.isActive,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(technician)
    } else {
      technician.displayName = before.displayName
      technician.isActive = before.isActive
      technician.deletedAt = null
      technician.updatedAt = new Date()
    }
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'created',
      entity: technician,
      identifiers: { id: technician.id, organizationId: technician.organizationId, tenantId: technician.tenantId },
      events: fieldTechnicianCrudEvents,
      indexer: technicianCrudIndexer,
    })
  },
}

registerCommand(createTechnicianCommand)
registerCommand(updateTechnicianCommand)
registerCommand(deleteTechnicianCommand)
