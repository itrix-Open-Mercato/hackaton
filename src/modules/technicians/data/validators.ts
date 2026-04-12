import { z } from 'zod'

const emptyToUndefined = z.literal('').transform(() => undefined)
const emptyToNull = z.literal('').transform(() => null)

const optionalStr = z.union([emptyToUndefined, z.string()]).optional()
const nullableStr = z.union([emptyToNull, z.string()]).nullable().optional()

export const locationStatusSchema = z.enum(['in_office', 'on_trip', 'at_client', 'unavailable'])
export const availabilityDayTypeSchema = z.enum(['work_day', 'trip', 'unavailable', 'holiday'])

export const technicianCreateSchema = z.object({
  staff_member_id: z.string().uuid(),
  is_active: z.coerce.boolean().default(true),
  display_name: optionalStr,
  first_name: optionalStr,
  last_name: optionalStr,
  email: optionalStr,
  phone: optionalStr,
  location_status: locationStatusSchema.optional().default('in_office'),
  languages: z.array(z.string()).optional().default([]),
  vehicle_id: optionalStr,
  vehicle_label: optionalStr,
  current_order_id: optionalStr,
  notes: optionalStr,
  skills: z.array(z.string().min(1)).optional(),
  certifications: z.array(z.object({
    name: z.string().min(1),
    cert_type: optionalStr,
    certificate_number: optionalStr,
    code: optionalStr,
    issued_at: optionalStr,
    expires_at: optionalStr,
    issued_by: optionalStr,
    notes: optionalStr,
  })).optional(),
})

export type TechnicianCreateInput = z.infer<typeof technicianCreateSchema>

export const technicianUpdateSchema = z.object({
  id: z.string().uuid(),
  is_active: z.coerce.boolean().optional(),
  display_name: nullableStr,
  first_name: nullableStr,
  last_name: nullableStr,
  email: nullableStr,
  phone: nullableStr,
  location_status: locationStatusSchema.optional(),
  languages: z.array(z.string()).optional(),
  vehicle_id: nullableStr,
  vehicle_label: nullableStr,
  current_order_id: nullableStr,
  notes: nullableStr,
})

export type TechnicianUpdateInput = z.infer<typeof technicianUpdateSchema>

export const skillAddSchema = z.object({
  technician_id: z.string().uuid(),
  name: z.string().min(1),
})

export type SkillAddInput = z.infer<typeof skillAddSchema>

export const skillRemoveSchema = z.object({
  id: z.string().uuid(),
})

export type SkillRemoveInput = z.infer<typeof skillRemoveSchema>

export const certificationAddSchema = z.object({
  technician_id: z.string().uuid(),
  name: z.string().min(1),
  cert_type: optionalStr,
  certificate_number: optionalStr,
  code: optionalStr,
  issued_at: optionalStr,
  expires_at: optionalStr,
  issued_by: optionalStr,
  notes: optionalStr,
})

export type CertificationAddInput = z.infer<typeof certificationAddSchema>

export const certificationUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  cert_type: nullableStr,
  certificate_number: nullableStr,
  code: nullableStr,
  issued_at: nullableStr,
  expires_at: nullableStr,
  issued_by: nullableStr,
  notes: nullableStr,
})

export type CertificationUpdateInput = z.infer<typeof certificationUpdateSchema>

export const certificationRemoveSchema = z.object({
  id: z.string().uuid(),
})

export type CertificationRemoveInput = z.infer<typeof certificationRemoveSchema>

export const availabilityCreateSchema = z.object({
  technician_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_type: availabilityDayTypeSchema.default('work_day'),
  notes: nullableStr,
})

export type AvailabilityCreateInput = z.infer<typeof availabilityCreateSchema>

export const availabilityUpdateSchema = z.object({
  id: z.string().uuid(),
  day_type: availabilityDayTypeSchema.optional(),
  notes: nullableStr,
})

export type AvailabilityUpdateInput = z.infer<typeof availabilityUpdateSchema>

export const availabilityDeleteSchema = z.object({
  id: z.string().uuid(),
})

export type AvailabilityDeleteInput = z.infer<typeof availabilityDeleteSchema>
