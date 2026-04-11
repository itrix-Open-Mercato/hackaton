import { z } from 'zod'

export const locationStatusSchema = z.enum(['in_office', 'on_trip', 'at_client', 'unavailable'])

export const fieldTechnicianCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  displayName: z.string().min(1).max(255),
  firstName: z.string().max(128).nullable().optional(),
  lastName: z.string().max(128).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  locationStatus: locationStatusSchema.optional().default('in_office'),
  skills: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional(),
  staffMemberId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  vehicleLabel: z.string().max(255).nullable().optional(),
  currentOrderId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export const fieldTechnicianUpdateSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(255).optional(),
  firstName: z.string().max(128).nullable().optional(),
  lastName: z.string().max(128).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  locationStatus: locationStatusSchema.optional(),
  skills: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  staffMemberId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  vehicleLabel: z.string().max(255).nullable().optional(),
  currentOrderId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const fieldTechnicianCertificationCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  technicianId: z.string().uuid(),
  name: z.string().min(1).max(255),
  certType: z.string().max(64).nullable().optional(),
  code: z.string().max(128).nullable().optional(),
  issuedAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  issuedBy: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const fieldTechnicianCertificationUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  certType: z.string().max(64).nullable().optional(),
  code: z.string().max(128).nullable().optional(),
  issuedAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  issuedBy: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const availabilityDayTypeSchema = z.enum(['work_day', 'trip', 'unavailable', 'holiday'])

export const fieldTechnicianAvailabilityCreateSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  technicianId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: availabilityDayTypeSchema.default('work_day'),
  notes: z.string().nullable().optional(),
})

export const fieldTechnicianAvailabilityUpdateSchema = z.object({
  id: z.string().uuid(),
  dayType: availabilityDayTypeSchema.optional(),
  notes: z.string().nullable().optional(),
})

export type FieldTechnicianAvailabilityCreateInput = z.infer<typeof fieldTechnicianAvailabilityCreateSchema>
export type FieldTechnicianAvailabilityUpdateInput = z.infer<typeof fieldTechnicianAvailabilityUpdateSchema>

export type FieldTechnicianCreateInput = z.infer<typeof fieldTechnicianCreateSchema>
export type FieldTechnicianUpdateInput = z.infer<typeof fieldTechnicianUpdateSchema>
export type FieldTechnicianCertificationCreateInput = z.infer<typeof fieldTechnicianCertificationCreateSchema>
export type FieldTechnicianCertificationUpdateInput = z.infer<typeof fieldTechnicianCertificationUpdateSchema>
