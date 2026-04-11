import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
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
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.create', 'Add certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: result.certificationId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

const updateCertificationCommand: CommandHandler<FieldTechnicianCertificationUpdateInput, { certificationId: string }> = {
  id: 'field_technicians.certifications.update',
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
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.update', 'Update certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: result.certificationId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

const deleteCertificationCommand: CommandHandler<{ id?: string }, { certificationId: string }> = {
  id: 'field_technicians.certifications.delete',
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
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('fieldTechnicians.audit.cert.delete', 'Remove certification'),
      resourceKind: 'field_technicians.certification',
      resourceId: result.certificationId,
      tenantId: '',
      organizationId: '',
      payload: {},
    }
  },
}

registerCommand(createCertificationCommand)
registerCommand(updateCertificationCommand)
registerCommand(deleteCertificationCommand)
