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

const DATETIME_TOKEN_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/

function isValidDateTimeToken(value: string): boolean {
  if (!DATETIME_TOKEN_REGEX.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

const datetimeStringSchema = z.string().refine(isValidDateTimeToken, {
  message: 'Expected an ISO 8601 datetime string',
})
const optionalDateTime = z.union([emptyToUndefined, datetimeStringSchema]).optional()
const nullableDateTime = z.union([emptyToNull, datetimeStringSchema]).nullable().optional()
const staffMemberIdsSchema = z
  .array(z.string().uuid())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Duplicate staff member IDs are not allowed',
  })
  .optional()

const locationSourceSchema = z.enum(['geocoded', 'manual']).nullable().optional()
// Accept number or numeric string; empty string / null → null
const nullableLatitude = z
  .union([z.literal(''), z.null(), z.coerce.number().min(-90).max(90)])
  .transform((v) => (v === '' || v === null ? null : (v as number)))
  .nullable()
  .optional()
const nullableLongitude = z
  .union([z.literal(''), z.null(), z.coerce.number().min(-180).max(180)])
  .transform((v) => (v === '' || v === null ? null : (v as number)))
  .nullable()
  .optional()

export const ticketCreateSchema = z.object({
  service_type: serviceTypeSchema,
  priority: ticketPrioritySchema.default('normal'),
  description: optionalStr,
  visit_date: optionalDateTime,
  visit_end_date: optionalDateTime,
  address: optionalStr,
  latitude: nullableLatitude,
  longitude: nullableLongitude,
  location_source: locationSourceSchema,
  customer_entity_id: optionalUuid,
  contact_person_id: optionalUuid,
  machine_instance_id: optionalUuid,
  order_id: optionalUuid,
  staff_member_ids: staffMemberIdsSchema,
  machine_service_type_ids: z.array(z.string().uuid()).optional(),
})

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>

export const ticketUpdateSchema = z.object({
  id: z.string().uuid(),
  service_type: serviceTypeSchema.optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  description: nullableStr,
  visit_date: nullableDateTime,
  visit_end_date: nullableDateTime,
  address: nullableStr,
  latitude: nullableLatitude,
  longitude: nullableLongitude,
  location_source: locationSourceSchema,
  customer_entity_id: nullableUuid,
  contact_person_id: nullableUuid,
  machine_instance_id: nullableUuid,
  order_id: nullableUuid,
  staff_member_ids: staffMemberIdsSchema,
  machine_service_type_ids: z.array(z.string().uuid()).optional(),
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
