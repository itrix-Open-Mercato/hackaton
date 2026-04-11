import { z } from 'zod'

export const serviceTypeSchema = z.enum(['commissioning', 'regular', 'warranty_claim', 'maintenance'])
export const ticketStatusSchema = z.enum(['new', 'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled'])
export const ticketPrioritySchema = z.enum(['normal', 'urgent', 'critical'])

const emptyToUndefined = z.literal('').transform(() => undefined)
const emptyToNull = z.literal('').transform(() => null)

const optionalUuid = z.union([emptyToUndefined, z.string().uuid()]).optional()
const nullableUuid = z.union([emptyToNull, z.string().uuid()]).nullable().optional()
const optionalStr = z.union([emptyToUndefined, z.string()]).optional()
const nullableStr = z.union([emptyToNull, z.string()]).nullable().optional()

export const ticketCreateSchema = z.object({
  service_type: serviceTypeSchema,
  priority: ticketPrioritySchema.default('normal'),
  description: optionalStr,
  visit_date: optionalStr,
  visit_end_date: optionalStr,
  address: optionalStr,
  customer_entity_id: optionalUuid,
  contact_person_id: optionalUuid,
  machine_asset_id: optionalUuid,
  order_id: optionalUuid,
  staff_member_ids: z.array(z.string().uuid()).optional(),
})

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>

export const ticketUpdateSchema = z.object({
  id: z.string().uuid(),
  service_type: serviceTypeSchema.optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  description: nullableStr,
  visit_date: nullableStr,
  visit_end_date: nullableStr,
  address: nullableStr,
  customer_entity_id: nullableUuid,
  contact_person_id: nullableUuid,
  machine_asset_id: nullableUuid,
  order_id: nullableUuid,
  staff_member_ids: z.array(z.string().uuid()).optional(),
})

export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>

export const assignmentCreateSchema = z.object({
  ticket_id: z.string().uuid(),
  staff_member_id: z.string().uuid(),
})

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>

export const partCreateSchema = z.object({
  ticket_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).default(1),
  notes: optionalStr,
})

export type PartCreateInput = z.infer<typeof partCreateSchema>

export const partUpdateSchema = z.object({
  id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).optional(),
  notes: nullableStr,
})

export type PartUpdateInput = z.infer<typeof partUpdateSchema>
