import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MachineCatalogProfile, MachineCatalogPartTemplate } from '../data/entities'
import {
  machineCatalogProfileCreateSchema,
  machineCatalogProfileUpdateSchema,
  machineCatalogPartTemplateCreateSchema,
  machineCatalogPartTemplateUpdateSchema,
  type MachineCatalogProfileCreateInput,
  type MachineCatalogProfileUpdateInput,
  type MachineCatalogPartTemplateCreateInput,
  type MachineCatalogPartTemplateUpdateInput,
} from '../data/validators'

// Profile commands
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
      supportedServiceTypes: parsed.supportedServiceTypes ?? null,
      requiredSkills: parsed.requiredSkills ?? null,
      requiredCertifications: parsed.requiredCertifications ?? null,
      defaultTeamSize: parsed.defaultTeamSize ?? null,
      defaultServiceDurationMinutes: parsed.defaultServiceDurationMinutes ?? null,
      preventiveMaintenanceIntervalDays: parsed.preventiveMaintenanceIntervalDays ?? null,
      defaultWarrantyMonths: parsed.defaultWarrantyMonths ?? null,
      startupNotes: parsed.startupNotes ?? null,
      serviceNotes: parsed.serviceNotes ?? null,
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
    if (parsed.supportedServiceTypes !== undefined) record.supportedServiceTypes = parsed.supportedServiceTypes ?? null
    if (parsed.requiredSkills !== undefined) record.requiredSkills = parsed.requiredSkills ?? null
    if (parsed.requiredCertifications !== undefined) record.requiredCertifications = parsed.requiredCertifications ?? null
    if (parsed.defaultTeamSize !== undefined) record.defaultTeamSize = parsed.defaultTeamSize ?? null
    if (parsed.defaultServiceDurationMinutes !== undefined) record.defaultServiceDurationMinutes = parsed.defaultServiceDurationMinutes ?? null
    if (parsed.preventiveMaintenanceIntervalDays !== undefined) record.preventiveMaintenanceIntervalDays = parsed.preventiveMaintenanceIntervalDays ?? null
    if (parsed.defaultWarrantyMonths !== undefined) record.defaultWarrantyMonths = parsed.defaultWarrantyMonths ?? null
    if (parsed.startupNotes !== undefined) record.startupNotes = parsed.startupNotes ?? null
    if (parsed.serviceNotes !== undefined) record.serviceNotes = parsed.serviceNotes ?? null
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

// Part template commands
const createPartTemplateCommand: CommandHandler<MachineCatalogPartTemplateCreateInput, { id: string }> = {
  id: 'machine_catalog.part_templates.create',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogPartTemplateCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(MachineCatalogPartTemplate, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      machineProfileId: parsed.machineProfileId,
      partCatalogProductId: parsed.partCatalogProductId ?? null,
      templateType: parsed.templateType,
      serviceContext: parsed.serviceContext ?? null,
      kitName: parsed.kitName ?? null,
      partName: parsed.partName,
      partCode: parsed.partCode ?? null,
      quantityDefault: parsed.quantityDefault ?? null,
      quantityUnit: parsed.quantityUnit ?? null,
      sortOrder: parsed.sortOrder ?? 0,
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const updatePartTemplateCommand: CommandHandler<MachineCatalogPartTemplateUpdateInput, { id: string }> = {
  id: 'machine_catalog.part_templates.update',
  async execute(rawInput, ctx) {
    const parsed = machineCatalogPartTemplateUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogPartTemplate, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Part template not found.' })

    if (parsed.partCatalogProductId !== undefined) record.partCatalogProductId = parsed.partCatalogProductId ?? null
    if (parsed.templateType !== undefined) record.templateType = parsed.templateType
    if (parsed.serviceContext !== undefined) record.serviceContext = parsed.serviceContext ?? null
    if (parsed.kitName !== undefined) record.kitName = parsed.kitName ?? null
    if (parsed.partName !== undefined) record.partName = parsed.partName
    if (parsed.partCode !== undefined) record.partCode = parsed.partCode ?? null
    if (parsed.quantityDefault !== undefined) record.quantityDefault = parsed.quantityDefault ?? null
    if (parsed.quantityUnit !== undefined) record.quantityUnit = parsed.quantityUnit ?? null
    if (parsed.sortOrder !== undefined) record.sortOrder = parsed.sortOrder
    if (parsed.notes !== undefined) record.notes = parsed.notes ?? null
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

const deletePartTemplateCommand: CommandHandler<{ id: string }, { id: string }> = {
  id: 'machine_catalog.part_templates.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Part template id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineCatalogPartTemplate, { id: input.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Part template not found.' })
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

registerCommand(createProfileCommand)
registerCommand(updateProfileCommand)
registerCommand(deleteProfileCommand)
registerCommand(createPartTemplateCommand)
registerCommand(updatePartTemplateCommand)
registerCommand(deletePartTemplateCommand)
