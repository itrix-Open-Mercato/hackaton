import { z } from 'zod'

const TEMPLATE_TYPES = ['component', 'consumable', 'service_kit_item'] as const
const SERVICE_CONTEXTS = ['startup', 'preventive', 'repair', 'reclamation', 'maintenance_presence'] as const

// Machine Profile
export const machineCatalogProfileCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  catalogProductId: z.string().uuid(),
  machineFamily: z.string().max(200).optional().nullable(),
  modelCode: z.string().max(100).optional().nullable(),
  supportedServiceTypes: z.array(z.string()).optional().nullable(),
  requiredSkills: z.array(z.string()).optional().nullable(),
  requiredCertifications: z.array(z.string()).optional().nullable(),
  defaultTeamSize: z.coerce.number().int().min(1).optional().nullable(),
  defaultServiceDurationMinutes: z.coerce.number().int().min(1).optional().nullable(),
  preventiveMaintenanceIntervalDays: z.coerce.number().int().min(1).optional().nullable(),
  defaultWarrantyMonths: z.coerce.number().int().min(1).optional().nullable(),
  startupNotes: z.string().optional().nullable(),
  serviceNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const machineCatalogProfileUpdateSchema = z.object({
  id: z.string().uuid(),
  machineFamily: z.string().max(200).optional().nullable(),
  modelCode: z.string().max(100).optional().nullable(),
  supportedServiceTypes: z.array(z.string()).optional().nullable(),
  requiredSkills: z.array(z.string()).optional().nullable(),
  requiredCertifications: z.array(z.string()).optional().nullable(),
  defaultTeamSize: z.coerce.number().int().min(1).optional().nullable(),
  defaultServiceDurationMinutes: z.coerce.number().int().min(1).optional().nullable(),
  preventiveMaintenanceIntervalDays: z.coerce.number().int().min(1).optional().nullable(),
  defaultWarrantyMonths: z.coerce.number().int().min(1).optional().nullable(),
  startupNotes: z.string().optional().nullable(),
  serviceNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

// Part Template
export const machineCatalogPartTemplateCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  machineProfileId: z.string().uuid(),
  partCatalogProductId: z.string().uuid().optional().nullable(),
  templateType: z.enum(TEMPLATE_TYPES),
  serviceContext: z.enum(SERVICE_CONTEXTS).optional().nullable(),
  kitName: z.string().max(200).optional().nullable(),
  partName: z.string().min(1).max(300),
  partCode: z.string().max(100).optional().nullable(),
  quantityDefault: z.coerce.number().positive().optional().nullable(),
  quantityUnit: z.string().max(20).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
})

export const machineCatalogPartTemplateUpdateSchema = z.object({
  id: z.string().uuid(),
  partCatalogProductId: z.string().uuid().optional().nullable(),
  templateType: z.enum(TEMPLATE_TYPES).optional(),
  serviceContext: z.enum(SERVICE_CONTEXTS).optional().nullable(),
  kitName: z.string().max(200).optional().nullable(),
  partName: z.string().min(1).max(300).optional(),
  partCode: z.string().max(100).optional().nullable(),
  quantityDefault: z.coerce.number().positive().optional().nullable(),
  quantityUnit: z.string().max(20).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
})

export type MachineCatalogProfileCreateInput = z.infer<typeof machineCatalogProfileCreateSchema>
export type MachineCatalogProfileUpdateInput = z.infer<typeof machineCatalogProfileUpdateSchema>
export type MachineCatalogPartTemplateCreateInput = z.infer<typeof machineCatalogPartTemplateCreateSchema>
export type MachineCatalogPartTemplateUpdateInput = z.infer<typeof machineCatalogPartTemplateUpdateSchema>
