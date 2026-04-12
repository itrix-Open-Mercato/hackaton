import { z } from 'zod'

// Machine Profile (removed: supportedServiceTypes, requiredSkills, requiredCertifications,
// defaultTeamSize, defaultServiceDurationMinutes, startupNotes, serviceNotes — now per-service-type)
export const machineCatalogProfileCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  catalogProductId: z.string().uuid(),
  machineFamily: z.string().max(200).optional().nullable(),
  modelCode: z.string().max(100).optional().nullable(),
  preventiveMaintenanceIntervalDays: z.coerce.number().int().min(1).optional().nullable(),
  defaultWarrantyMonths: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const machineCatalogProfileUpdateSchema = z.object({
  id: z.string().uuid(),
  machineFamily: z.string().max(200).optional().nullable(),
  modelCode: z.string().max(100).optional().nullable(),
  preventiveMaintenanceIntervalDays: z.coerce.number().int().min(1).optional().nullable(),
  defaultWarrantyMonths: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
})

// Service Type
export const machineCatalogServiceTypeCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  machineProfileId: z.string().uuid(),
  serviceType: z.string().min(1).max(200),
  defaultTeamSize: z.coerce.number().int().min(1).optional().nullable(),
  defaultServiceDurationMinutes: z.coerce.number().int().min(1).optional().nullable(),
  startupNotes: z.string().optional().nullable(),
  serviceNotes: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const machineCatalogServiceTypeUpdateSchema = z.object({
  id: z.string().uuid(),
  serviceType: z.string().min(1).max(200).optional(),
  defaultTeamSize: z.coerce.number().int().min(1).optional().nullable(),
  defaultServiceDurationMinutes: z.coerce.number().int().min(1).optional().nullable(),
  startupNotes: z.string().optional().nullable(),
  serviceNotes: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

// Service Type Skill
export const machineCatalogServiceTypeSkillCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  machineServiceTypeId: z.string().uuid(),
  skillName: z.string().min(1).max(300),
})

// Service Type Certification
export const machineCatalogServiceTypeCertificationCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  machineServiceTypeId: z.string().uuid(),
  certificationName: z.string().min(1).max(300),
})

// Service Type Part
export const machineCatalogServiceTypePartCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  machineServiceTypeId: z.string().uuid(),
  catalogProductId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const machineCatalogServiceTypePartUpdateSchema = z.object({
  id: z.string().uuid(),
  quantity: z.coerce.number().positive().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export type MachineCatalogProfileCreateInput = z.infer<typeof machineCatalogProfileCreateSchema>
export type MachineCatalogProfileUpdateInput = z.infer<typeof machineCatalogProfileUpdateSchema>
export type MachineCatalogServiceTypeCreateInput = z.infer<typeof machineCatalogServiceTypeCreateSchema>
export type MachineCatalogServiceTypeUpdateInput = z.infer<typeof machineCatalogServiceTypeUpdateSchema>
export type MachineCatalogServiceTypeSkillCreateInput = z.infer<typeof machineCatalogServiceTypeSkillCreateSchema>
export type MachineCatalogServiceTypeCertificationCreateInput = z.infer<typeof machineCatalogServiceTypeCertificationCreateSchema>
export type MachineCatalogServiceTypePartCreateInput = z.infer<typeof machineCatalogServiceTypePartCreateSchema>
export type MachineCatalogServiceTypePartUpdateInput = z.infer<typeof machineCatalogServiceTypePartUpdateSchema>
