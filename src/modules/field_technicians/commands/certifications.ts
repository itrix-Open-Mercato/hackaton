import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { buildChanges, emitCrudSideEffects, emitCrudUndoSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { FieldTechnicianCertification } from '../data/entities'
import {
  fieldTechnicianCertificationCreateSchema,
  fieldTechnicianCertificationUpdateSchema,
  type FieldTechnicianCertificationCreateInput,
  type FieldTechnicianCertificationUpdateInput,
} from '../data/validators'
import { fieldTechnicianCertificationCrudEvents, FIELD_TECHNICIAN_CERT_ENTITY_TYPE } from '../lib/crud'

const certCrudIndexer: CrudIndexerConfig<FieldTechnicianCertification> = {
  entityType: FIELD_TECHNICIAN_CERT_ENTITY_TYPE,
}

type CertificationSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  technicianId: string
  name: string
  certType: string | null
  code: string | null
  issuedAt: string | null
  expiresAt: string | null
  issuedBy: string | null
  notes: string | null
  deletedAt: string | null
}

type CertificationUndoPayload = {
  before?: CertificationSnapshot | null
  after?: CertificationSnapshot | null
}

async function loadCertificationSnapshot(em: EntityManager, id: string): Promise<CertificationSnapshot | null> {
  const certification = await findOneWithDecryption(
    em,
    FieldTechnicianCertification,
    { id },
    undefined,
    { tenantId: null, organizationId: null },
  )
  if (!certification) return null

  return {
    id: certification.id,
    tenantId: certification.tenantId,
    organizationId: certification.organizationId,
    technicianId: certification.technicianId,
    name: certification.name,
    certType: certification.certType ?? null,
    code: certification.code ?? null,
    issuedAt: certification.issuedAt ? certification.issuedAt.toISOString() : null,
    expiresAt: certification.expiresAt ? certification.expiresAt.toISOString() : null,
    issuedBy: certification.issuedBy ?? null,
    notes: certification.notes ?? null,
    deletedAt: certification.deletedAt ? certification.deletedAt.toISOString() : null,
  }
}

const createCertificationCommand: CommandHandler<FieldTechnicianCertificationCreateInput, { certificationId: string }> = {
  id: 'field_technicians.certifications.create',
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianCertificationCreateSchema.parse(rawInput)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const cert = em.create(FieldTechnicianCertification, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      technicianId: parsed.technicianId,
      name: parsed.name,
      certType: parsed.certType ?? null,
      code: parsed.code ?? null,
      issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : null,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      issuedBy: parsed.issuedBy ?? null,
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(cert)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: cert,
      identifiers: { id: cert.id, organizationId: cert.organizationId, tenantId: cert.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })

    return { certificationId: cert.id }
  },
  buildLog: async ({ result, ctx }) => {
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadCertificationSnapshot(em.fork(), result.certificationId)
    if (!snapshot) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.create', 'Add certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: snapshot.id,
      tenantId: snapshot.tenantId,
      organizationId: snapshot.organizationId,
      snapshotAfter: snapshot,
      payload: { undo: { after: snapshot } satisfies CertificationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as CertificationUndoPayload | undefined
    const after = payload?.after
    if (!after) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const certification = await em.findOne(FieldTechnicianCertification, { id: after.id })
    if (!certification) return

    certification.deletedAt = new Date()
    certification.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: certification,
      identifiers: { id: certification.id, organizationId: certification.organizationId, tenantId: certification.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })
  },
}

const updateCertificationCommand: CommandHandler<FieldTechnicianCertificationUpdateInput, { certificationId: string }> = {
  id: 'field_technicians.certifications.update',
  async prepare(rawInput, ctx) {
    const parsed = fieldTechnicianCertificationUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadCertificationSnapshot(em, parsed.id)
    if (!snapshot) return {}
    return { before: snapshot }
  },
  async execute(rawInput, ctx) {
    const parsed = fieldTechnicianCertificationUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const cert = await findOneWithDecryption(
      em,
      FieldTechnicianCertification,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!cert) throw new CrudHttpError(404, { error: 'Certification not found.' })

    if (parsed.name !== undefined) cert.name = parsed.name
    if (parsed.certType !== undefined) cert.certType = parsed.certType ?? null
    if (parsed.code !== undefined) cert.code = parsed.code ?? null
    if (parsed.issuedAt !== undefined) cert.issuedAt = parsed.issuedAt ? new Date(parsed.issuedAt) : null
    if (parsed.expiresAt !== undefined) cert.expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null
    if (parsed.issuedBy !== undefined) cert.issuedBy = parsed.issuedBy ?? null
    if (parsed.notes !== undefined) cert.notes = parsed.notes ?? null
    cert.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: cert,
      identifiers: { id: cert.id, organizationId: cert.organizationId, tenantId: cert.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })

    return { certificationId: cert.id }
  },
  buildLog: async ({ result, snapshots, ctx }) => {
    const before = snapshots.before as CertificationSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadCertificationSnapshot(em, result.certificationId)
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.update', 'Update certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      changes: buildChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        ['name', 'certType', 'code', 'issuedAt', 'expiresAt', 'issuedBy', 'notes'],
      ),
      payload: { undo: { before, after } satisfies CertificationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as CertificationUndoPayload | undefined
    const before = payload?.before
    if (!before) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const certification = await em.findOne(FieldTechnicianCertification, { id: before.id })
    if (!certification) return

    certification.name = before.name
    certification.certType = before.certType ?? null
    certification.code = before.code ?? null
    certification.issuedAt = before.issuedAt ? new Date(before.issuedAt) : null
    certification.expiresAt = before.expiresAt ? new Date(before.expiresAt) : null
    certification.issuedBy = before.issuedBy ?? null
    certification.notes = before.notes ?? null
    certification.deletedAt = before.deletedAt ? new Date(before.deletedAt) : null
    certification.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: certification,
      identifiers: { id: certification.id, organizationId: certification.organizationId, tenantId: certification.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })
  },
}

const deleteCertificationCommand: CommandHandler<{ id?: string }, { certificationId: string }> = {
  id: 'field_technicians.certifications.delete',
  async prepare(input, ctx) {
    const id = input?.id
    if (!id) throw new CrudHttpError(400, { error: 'Certification id is required.' })
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadCertificationSnapshot(em, id)
    if (!snapshot) return {}
    return { before: snapshot }
  },
  async execute(input, ctx) {
    const id = input?.id
    if (!id) throw new CrudHttpError(400, { error: 'Certification id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const cert = await findOneWithDecryption(
      em,
      FieldTechnicianCertification,
      { id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!cert) throw new CrudHttpError(404, { error: 'Certification not found.' })

    cert.deletedAt = new Date()
    cert.updatedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: cert,
      identifiers: { id: cert.id, organizationId: cert.organizationId, tenantId: cert.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })

    return { certificationId: cert.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as CertificationSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.delete', 'Remove certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies CertificationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as CertificationUndoPayload | undefined
    const before = payload?.before
    if (!before) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let certification = await em.findOne(FieldTechnicianCertification, { id: before.id })
    if (!certification) {
      certification = em.create(FieldTechnicianCertification, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        technicianId: before.technicianId,
        name: before.name,
        certType: before.certType ?? null,
        code: before.code ?? null,
        issuedAt: before.issuedAt ? new Date(before.issuedAt) : null,
        expiresAt: before.expiresAt ? new Date(before.expiresAt) : null,
        issuedBy: before.issuedBy ?? null,
        notes: before.notes ?? null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(certification)
    } else {
      certification.technicianId = before.technicianId
      certification.name = before.name
      certification.certType = before.certType ?? null
      certification.code = before.code ?? null
      certification.issuedAt = before.issuedAt ? new Date(before.issuedAt) : null
      certification.expiresAt = before.expiresAt ? new Date(before.expiresAt) : null
      certification.issuedBy = before.issuedBy ?? null
      certification.notes = before.notes ?? null
      certification.deletedAt = null
      certification.updatedAt = new Date()
    }
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'created',
      entity: certification,
      identifiers: { id: certification.id, organizationId: certification.organizationId, tenantId: certification.tenantId },
      events: fieldTechnicianCertificationCrudEvents,
      indexer: certCrudIndexer,
    })
  },
}

registerCommand(createCertificationCommand)
registerCommand(updateCertificationCommand)
registerCommand(deleteCertificationCommand)
