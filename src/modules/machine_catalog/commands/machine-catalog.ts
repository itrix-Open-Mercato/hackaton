import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  MachineCatalogProfile,
  MachineCatalogServiceType,
  MachineCatalogServiceTypeSkill,
  MachineCatalogServiceTypeCertification,
  MachineCatalogServiceTypePart,
} from '../data/entities'
import {
  machineCatalogProfileCreateSchema,
  machineCatalogProfileUpdateSchema,
  machineCatalogServiceTypeCreateSchema,
  machineCatalogServiceTypeUpdateSchema,
  machineCatalogServiceTypeSkillCreateSchema,
  machineCatalogServiceTypeCertificationCreateSchema,
  machineCatalogServiceTypePartCreateSchema,
  machineCatalogServiceTypePartUpdateSchema,
  type MachineCatalogProfileCreateInput,
  type MachineCatalogProfileUpdateInput,
  type MachineCatalogServiceTypeCreateInput,
  type MachineCatalogServiceTypeUpdateInput,
  type MachineCatalogServiceTypeSkillCreateInput,
  type MachineCatalogServiceTypeCertificationCreateInput,
  type MachineCatalogServiceTypePartCreateInput,
  type MachineCatalogServiceTypePartUpdateInput,
} from '../data/validators'

// ─── Profile commands ────────────────────────────────────────────────────────

const createProfileCommand: CommandHandler<MachineCatalogProfileCreateInput, { id: string }> = {
  id: 'machine_catalog.profiles.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogProfileCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(MachineCatalogProfile, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      catalogProductId: parsed.catalogProductId,
      machineFamily: parsed.machineFamily ?? null,
      modelCode: parsed.modelCode ?? null,
      preventiveMaintenanceIntervalDays: parsed.preventiveMaintenanceIntervalDays ?? null,
      defaultWarrantyMonths: parsed.defaultWarrantyMonths ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const updateProfileCommand: CommandHandler<MachineCatalogProfileUpdateInput, { id: string }> = {
  id: 'machine_catalog.profiles.update',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogProfileUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogProfile, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Machine profile not found.' })

    if (parsed.machineFamily !== undefined) record.machineFamily = parsed.machineFamily ?? null
    if (parsed.modelCode !== undefined) record.modelCode = parsed.modelCode ?? null
    if (parsed.preventiveMaintenanceIntervalDays !== undefined) record.preventiveMaintenanceIntervalDays = parsed.preventiveMaintenanceIntervalDays ?? null
    if (parsed.defaultWarrantyMonths !== undefined) record.defaultWarrantyMonths = parsed.defaultWarrantyMonths ?? null
    if (parsed.isActive !== undefined) record.isActive = parsed.isActive
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

const deleteProfileCommand: CommandHandler<{ id: string }, { id: string }> = {
  id: 'machine_catalog.profiles.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Profile id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogProfile, { id: input.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Machine profile not found.' })
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

// ─── Service Type commands ───────────────────────────────────────────────────

const createServiceTypeCommand: CommandHandler<MachineCatalogServiceTypeCreateInput, { id: string }> = {
  id: 'machine_catalog.service_types.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypeCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    // Inherit tenant/org from the parent profile so scope always matches
    const profile = await em.findOne(MachineCatalogProfile, { id: parsed.machineProfileId, deletedAt: null })
    if (!profile) throw new CrudHttpError(404, { error: 'Machine profile not found.' })
    const tenantId = profile.tenantId
    const organizationId = profile.organizationId

    const now = new Date()
    const record = em.create(MachineCatalogServiceType, {
      tenantId,
      organizationId,
      machineProfileId: parsed.machineProfileId,
      serviceType: parsed.serviceType,
      defaultTeamSize: parsed.defaultTeamSize ?? null,
      defaultServiceDurationMinutes: parsed.defaultServiceDurationMinutes ?? null,
      startupNotes: parsed.startupNotes ?? null,
      serviceNotes: parsed.serviceNotes ?? null,
      sortOrder: parsed.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const updateServiceTypeCommand: CommandHandler<MachineCatalogServiceTypeUpdateInput, { id: string }> = {
  id: 'machine_catalog.service_types.update',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypeUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceType, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Service type not found.' })

    if (parsed.serviceType !== undefined) record.serviceType = parsed.serviceType
    if (parsed.defaultTeamSize !== undefined) record.defaultTeamSize = parsed.defaultTeamSize ?? null
    if (parsed.defaultServiceDurationMinutes !== undefined) record.defaultServiceDurationMinutes = parsed.defaultServiceDurationMinutes ?? null
    if (parsed.startupNotes !== undefined) record.startupNotes = parsed.startupNotes ?? null
    if (parsed.serviceNotes !== undefined) record.serviceNotes = parsed.serviceNotes ?? null
    if (parsed.sortOrder !== undefined) record.sortOrder = parsed.sortOrder
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

const deleteServiceTypeCommand: CommandHandler<{ id: string }, { id: string }> = {
  id: 'machine_catalog.service_types.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Service type id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceType, { id: input.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Service type not found.' })

    // Cascade: delete child skills, certifications, parts
    const knex = (em as any).getConnection().getKnex()
    await knex('machine_catalog_service_type_skills').where({ machine_service_type_id: input.id }).delete()
    await knex('machine_catalog_service_type_certifications').where({ machine_service_type_id: input.id }).delete()
    await knex('machine_catalog_service_type_parts').where({ machine_service_type_id: input.id }).delete()

    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

// ─── Service Type Skill commands ─────────────────────────────────────────────

const createServiceTypeSkillCommand: CommandHandler<MachineCatalogServiceTypeSkillCreateInput, { id: string }> = {
  id: 'machine_catalog.service_type_skills.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypeSkillCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    // Inherit scope from parent service type
    const st = await em.findOne(MachineCatalogServiceType, { id: parsed.machineServiceTypeId, deletedAt: null })
    if (!st) throw new CrudHttpError(404, { error: 'Service type not found.' })

    // Check for duplicate
    const existing = await em.findOne(MachineCatalogServiceTypeSkill, {
      machineServiceTypeId: parsed.machineServiceTypeId,
      skillName: parsed.skillName,
    })
    if (existing) return { id: existing.id }

    const record = em.create(MachineCatalogServiceTypeSkill, {
      tenantId: st.tenantId,
      organizationId: st.organizationId,
      machineServiceTypeId: parsed.machineServiceTypeId,
      skillName: parsed.skillName,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const deleteServiceTypeSkillCommand: CommandHandler<{ id: string }, { ok: boolean }> = {
  id: 'machine_catalog.service_type_skills.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Skill id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceTypeSkill, { id: input.id })
    if (!record) throw new CrudHttpError(404, { error: 'Skill not found.' })
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

// ─── Service Type Certification commands ─────────────────────────────────────

const createServiceTypeCertificationCommand: CommandHandler<MachineCatalogServiceTypeCertificationCreateInput, { id: string }> = {
  id: 'machine_catalog.service_type_certifications.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypeCertificationCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    // Inherit scope from parent service type
    const st = await em.findOne(MachineCatalogServiceType, { id: parsed.machineServiceTypeId, deletedAt: null })
    if (!st) throw new CrudHttpError(404, { error: 'Service type not found.' })

    // Check for duplicate
    const existing = await em.findOne(MachineCatalogServiceTypeCertification, {
      machineServiceTypeId: parsed.machineServiceTypeId,
      certificationName: parsed.certificationName,
    })
    if (existing) return { id: existing.id }

    const record = em.create(MachineCatalogServiceTypeCertification, {
      tenantId: st.tenantId,
      organizationId: st.organizationId,
      machineServiceTypeId: parsed.machineServiceTypeId,
      certificationName: parsed.certificationName,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const deleteServiceTypeCertificationCommand: CommandHandler<{ id: string }, { ok: boolean }> = {
  id: 'machine_catalog.service_type_certifications.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Certification id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceTypeCertification, { id: input.id })
    if (!record) throw new CrudHttpError(404, { error: 'Certification not found.' })
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

// ─── Service Type Part commands ───────────────────────────────────────────────

const createServiceTypePartCommand: CommandHandler<MachineCatalogServiceTypePartCreateInput, { id: string }> = {
  id: 'machine_catalog.service_type_parts.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypePartCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    // Inherit scope from parent service type
    const st = await em.findOne(MachineCatalogServiceType, { id: parsed.machineServiceTypeId, deletedAt: null })
    if (!st) throw new CrudHttpError(404, { error: 'Service type not found.' })

    const now = new Date()
    const record = em.create(MachineCatalogServiceTypePart, {
      tenantId: st.tenantId,
      organizationId: st.organizationId,
      machineServiceTypeId: parsed.machineServiceTypeId,
      catalogProductId: parsed.catalogProductId,
      quantity: parsed.quantity,
      sortOrder: parsed.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const updateServiceTypePartCommand: CommandHandler<MachineCatalogServiceTypePartUpdateInput, { id: string }> = {
  id: 'machine_catalog.service_type_parts.update',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogServiceTypePartUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceTypePart, { id: parsed.id })
    if (!record) throw new CrudHttpError(404, { error: 'Service type part not found.' })

    if (parsed.quantity !== undefined) record.quantity = parsed.quantity
    if (parsed.sortOrder !== undefined) record.sortOrder = parsed.sortOrder
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

const deleteServiceTypePartCommand: CommandHandler<{ id: string }, { ok: boolean }> = {
  id: 'machine_catalog.service_type_parts.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Part id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogServiceTypePart, { id: input.id })
    if (!record) throw new CrudHttpError(404, { error: 'Service type part not found.' })
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

// ─── Register all ─────────────────────────────────────────────────────────────

registerCommand(createProfileCommand)
registerCommand(updateProfileCommand)
registerCommand(deleteProfileCommand)
registerCommand(createServiceTypeCommand)
registerCommand(updateServiceTypeCommand)
registerCommand(deleteServiceTypeCommand)
registerCommand(createServiceTypeSkillCommand)
registerCommand(deleteServiceTypeSkillCommand)
registerCommand(createServiceTypeCertificationCommand)
registerCommand(deleteServiceTypeCertificationCommand)
registerCommand(createServiceTypePartCommand)
registerCommand(updateServiceTypePartCommand)
registerCommand(deleteServiceTypePartCommand)
