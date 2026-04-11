import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MachineInstance } from '../data/entities'
import {
  machineInstanceCreateSchema,
  machineInstanceUpdateSchema,
  type MachineInstanceCreateInput,
  type MachineInstanceUpdateInput,
} from '../data/validators'

const createMachineInstanceCommand: CommandHandler<MachineInstanceCreateInput, { id: string }> = {
  id: 'machine_instances.machines.create',
  async execute(rawInput, ctx) {
    const parsed = machineInstanceCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(MachineInstance, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      catalogProductId: parsed.catalogProductId ?? null,
      instanceCode: parsed.instanceCode,
      serialNumber: parsed.serialNumber ?? null,
      customerCompanyId: parsed.customerCompanyId ?? null,
      siteName: parsed.siteName ?? null,
      siteAddress: parsed.siteAddress ?? null,
      locationLabel: parsed.locationLabel ?? null,
      contactName: parsed.contactName ?? null,
      contactPhone: parsed.contactPhone ?? null,
      manufacturedAt: parsed.manufacturedAt ?? null,
      commissionedAt: parsed.commissionedAt ?? null,
      warrantyUntil: parsed.warrantyUntil ?? null,
      warrantyStatus: parsed.warrantyStatus ?? null,
      lastInspectionAt: parsed.lastInspectionAt ?? null,
      nextInspectionAt: parsed.nextInspectionAt ?? null,
      serviceCount: parsed.serviceCount ?? null,
      complaintCount: parsed.complaintCount ?? null,
      lastServiceCaseCode: parsed.lastServiceCaseCode ?? null,
      requiresAnnouncement: parsed.requiresAnnouncement ?? false,
      announcementLeadTimeHours: parsed.announcementLeadTimeHours ?? null,
      instanceNotes: parsed.instanceNotes ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const updateMachineInstanceCommand: CommandHandler<MachineInstanceUpdateInput, { id: string }> = {
  id: 'machine_instances.machines.update',
  async execute(rawInput, ctx) {
    const parsed = machineInstanceUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineInstance, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Machine instance not found.' })

    if (parsed.catalogProductId !== undefined) record.catalogProductId = parsed.catalogProductId ?? null
    if (parsed.instanceCode !== undefined) record.instanceCode = parsed.instanceCode
    if (parsed.serialNumber !== undefined) record.serialNumber = parsed.serialNumber ?? null
    if (parsed.customerCompanyId !== undefined) record.customerCompanyId = parsed.customerCompanyId ?? null
    if (parsed.siteName !== undefined) record.siteName = parsed.siteName ?? null
    if (parsed.siteAddress !== undefined) record.siteAddress = parsed.siteAddress ?? null
    if (parsed.locationLabel !== undefined) record.locationLabel = parsed.locationLabel ?? null
    if (parsed.contactName !== undefined) record.contactName = parsed.contactName ?? null
    if (parsed.contactPhone !== undefined) record.contactPhone = parsed.contactPhone ?? null
    if (parsed.manufacturedAt !== undefined) record.manufacturedAt = parsed.manufacturedAt ?? null
    if (parsed.commissionedAt !== undefined) record.commissionedAt = parsed.commissionedAt ?? null
    if (parsed.warrantyUntil !== undefined) record.warrantyUntil = parsed.warrantyUntil ?? null
    if (parsed.warrantyStatus !== undefined) record.warrantyStatus = parsed.warrantyStatus ?? null
    if (parsed.lastInspectionAt !== undefined) record.lastInspectionAt = parsed.lastInspectionAt ?? null
    if (parsed.nextInspectionAt !== undefined) record.nextInspectionAt = parsed.nextInspectionAt ?? null
    if (parsed.serviceCount !== undefined) record.serviceCount = parsed.serviceCount ?? null
    if (parsed.complaintCount !== undefined) record.complaintCount = parsed.complaintCount ?? null
    if (parsed.lastServiceCaseCode !== undefined) record.lastServiceCaseCode = parsed.lastServiceCaseCode ?? null
    if (parsed.requiresAnnouncement !== undefined) record.requiresAnnouncement = parsed.requiresAnnouncement
    if (parsed.announcementLeadTimeHours !== undefined) record.announcementLeadTimeHours = parsed.announcementLeadTimeHours ?? null
    if (parsed.instanceNotes !== undefined) record.instanceNotes = parsed.instanceNotes ?? null
    if (parsed.isActive !== undefined) record.isActive = parsed.isActive
    record.updatedAt = new Date()

    await em.flush()
    return { id: record.id }
  },
}

const deleteMachineInstanceCommand: CommandHandler<{ id: string }, { id: string }> = {
  id: 'machine_instances.machines.delete',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Machine instance id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(MachineInstance, { id: input.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Machine instance not found.' })
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
    return { id: record.id }
  },
}

registerCommand(createMachineInstanceCommand)
registerCommand(updateMachineInstanceCommand)
registerCommand(deleteMachineInstanceCommand)
