import { z } from 'zod'

const emptyToUndefined = z.literal('').transform(() => undefined)
const emptyToNull = z.literal('').transform(() => null)

const optionalStr = z.union([emptyToUndefined, z.string()]).optional()
const nullableStr = z.union([emptyToNull, z.string()]).nullable().optional()

export const technicianCreateSchema = z.object({
  staff_member_id: z.string().uuid(),
  is_active: z.coerce.boolean().default(true),
  notes: optionalStr,
  skills: z.array(z.string().min(1)).optional(),
  certifications: z.array(z.object({
    name: z.string().min(1),
    certificate_number: optionalStr,
    issued_at: optionalStr,
    expires_at: optionalStr,
  })).optional(),
})

export type TechnicianCreateInput = z.infer<typeof technicianCreateSchema>

export const technicianUpdateSchema = z.object({
  id: z.string().uuid(),
  is_active: z.coerce.boolean().optional(),
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
  certificate_number: optionalStr,
  issued_at: optionalStr,
  expires_at: optionalStr,
})

export type CertificationAddInput = z.infer<typeof certificationAddSchema>

export const certificationUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  certificate_number: nullableStr,
  issued_at: nullableStr,
  expires_at: nullableStr,
})

export type CertificationUpdateInput = z.infer<typeof certificationUpdateSchema>

export const certificationRemoveSchema = z.object({
  id: z.string().uuid(),
})

export type CertificationRemoveInput = z.infer<typeof certificationRemoveSchema>
