import { z } from 'zod'

const WARRANTY_STATUSES = ['active', 'expired', 'claim'] as const

export const machineInstanceCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  catalogProductId: z.string().uuid().optional().nullable(),
  instanceCode: z.string().min(1).max(100),
  serialNumber: z.string().max(200).optional().nullable(),
  customerCompanyId: z.string().uuid().optional().nullable(),
  siteName: z.string().max(300).optional().nullable(),
  siteAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  locationLabel: z.string().max(300).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  manufacturedAt: z.coerce.date().optional().nullable(),
  commissionedAt: z.coerce.date().optional().nullable(),
  warrantyUntil: z.coerce.date().optional().nullable(),
  warrantyStatus: z.enum(WARRANTY_STATUSES).optional().nullable(),
  lastInspectionAt: z.coerce.date().optional().nullable(),
  nextInspectionAt: z.coerce.date().optional().nullable(),
  serviceCount: z.coerce.number().int().min(0).optional().nullable(),
  complaintCount: z.coerce.number().int().min(0).optional().nullable(),
  lastServiceCaseCode: z.string().max(100).optional().nullable(),
  requiresAnnouncement: z.boolean().optional(),
  announcementLeadTimeHours: z.coerce.number().int().min(0).optional().nullable(),
  instanceNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const machineInstanceUpdateSchema = z.object({
  id: z.string().uuid(),
  catalogProductId: z.string().uuid().optional().nullable(),
  instanceCode: z.string().min(1).max(100).optional(),
  serialNumber: z.string().max(200).optional().nullable(),
  customerCompanyId: z.string().uuid().optional().nullable(),
  siteName: z.string().max(300).optional().nullable(),
  siteAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  locationLabel: z.string().max(300).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  manufacturedAt: z.coerce.date().optional().nullable(),
  commissionedAt: z.coerce.date().optional().nullable(),
  warrantyUntil: z.coerce.date().optional().nullable(),
  warrantyStatus: z.enum(WARRANTY_STATUSES).optional().nullable(),
  lastInspectionAt: z.coerce.date().optional().nullable(),
  nextInspectionAt: z.coerce.date().optional().nullable(),
  serviceCount: z.coerce.number().int().min(0).optional().nullable(),
  complaintCount: z.coerce.number().int().min(0).optional().nullable(),
  lastServiceCaseCode: z.string().max(100).optional().nullable(),
  requiresAnnouncement: z.boolean().optional(),
  announcementLeadTimeHours: z.coerce.number().int().min(0).optional().nullable(),
  instanceNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export type MachineInstanceCreateInput = z.infer<typeof machineInstanceCreateSchema>
export type MachineInstanceUpdateInput = z.infer<typeof machineInstanceUpdateSchema>
