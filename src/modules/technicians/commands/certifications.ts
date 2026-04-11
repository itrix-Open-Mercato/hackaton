import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Technician, TechnicianCertification } from '../data/entities'
import { certificationAddSchema, certificationUpdateSchema, certificationRemoveSchema } from '../data/validators'
import { ensureScope } from './technicians'

export const addCertificationCommand: CommandHandler<Record<string, unknown>, TechnicianCertification> = {
  id: 'technicians.certifications.add',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = certificationAddSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const technician = await em.findOne(Technician, {
      id: parsed.technician_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    const cert = await de.createOrmEntity({
      entity: TechnicianCertification,
      data: {
        technician,
        name: parsed.name,
        certificateNumber: parsed.certificate_number ?? null,
        issuedAt: parsed.issued_at ? new Date(parsed.issued_at) : null,
        expiresAt: parsed.expires_at ? new Date(parsed.expires_at) : null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return cert
  },
}

export const updateCertificationCommand: CommandHandler<Record<string, unknown>, TechnicianCertification> = {
  id: 'technicians.certifications.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = certificationUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const cert = await de.updateOrmEntity({
      entity: TechnicianCertification,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<TechnicianCertification>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.certificate_number !== undefined) entity.certificateNumber = parsed.certificate_number
        if (parsed.issued_at !== undefined) entity.issuedAt = parsed.issued_at ? new Date(parsed.issued_at) : null
        if (parsed.expires_at !== undefined) entity.expiresAt = parsed.expires_at ? new Date(parsed.expires_at) : null
      },
    })
    if (!cert) throw new CrudHttpError(404, { error: 'Certification not found' })

    return cert
  },
}

export const removeCertificationCommand: CommandHandler<Record<string, unknown>, { ok: boolean }> = {
  id: 'technicians.certifications.remove',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = certificationRemoveSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    const cert = await em.findOne(TechnicianCertification, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<TechnicianCertification>)
    if (!cert) throw new CrudHttpError(404, { error: 'Certification not found' })

    em.remove(cert)
    await em.flush()

    return { ok: true }
  },
}

registerCommand(addCertificationCommand)
registerCommand(updateCertificationCommand)
registerCommand(removeCertificationCommand)
