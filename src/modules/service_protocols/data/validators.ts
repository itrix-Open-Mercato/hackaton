import { z } from 'zod'

const emptyToNull = z.literal('').transform(() => null)
const nullableUuid = z.union([emptyToNull, z.string().uuid()]).nullable().optional()
const nullableStr = z.union([emptyToNull, z.string()]).nullable().optional()
const optionalStr = z.union([z.literal('').transform(() => undefined), z.string()]).optional()

const nullableDecimal = z
  .union([z.literal(''), z.null(), z.coerce.number().min(0)])
  .transform((v) => (v === '' || v === null ? null : (v as number)))
  .nullable()
  .optional()

const nonNegativeDecimal = z.coerce.number().min(0).optional()
const nonNegativeInt = z.coerce.number().int().min(0).optional()

export const protocolStatusSchema = z.enum(['draft', 'in_review', 'approved', 'closed', 'cancelled'])
export const protocolTypeSchema = z.enum(['standard', 'valuation_only'])
export const partLineStatusSchema = z.enum(['proposed', 'confirmed', 'added', 'removed'])

// ISO 3166-1 alpha-2 country code (2 uppercase letters)
const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Must be an ISO 3166-1 alpha-2 country code')
  .nullable()
  .optional()

// --- Protocol schemas ---

export const createProtocolFromTicketSchema = z.object({
  service_ticket_id: z.string().uuid(),
})
export type CreateProtocolFromTicketInput = z.infer<typeof createProtocolFromTicketSchema>

export const updateProtocolSchema = z.object({
  id: z.string().uuid(),
  // Technician-editable
  work_description: nullableStr,
  technician_notes: nullableStr,
  customer_notes: nullableStr,
  // Coordinator-editable (header snapshots)
  customer_entity_id: nullableUuid,
  contact_person_id: nullableUuid,
  machine_asset_id: nullableUuid,
  service_address_snapshot: z.record(z.unknown()).nullable().optional(),
  ticket_description_snapshot: nullableStr,
  planned_visit_date_snapshot: nullableStr,
  planned_visit_end_date_snapshot: nullableStr,
  type: protocolTypeSchema.optional(),
})
export type UpdateProtocolInput = z.infer<typeof updateProtocolSchema>

// --- Status action schemas ---

export const submitSchema = z.object({ id: z.string().uuid() })
export type SubmitInput = z.infer<typeof submitSchema>

export const rejectSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().min(1, 'Notes are required for rejection'),
})
export type RejectInput = z.infer<typeof rejectSchema>

export const approveSchema = z.object({ id: z.string().uuid() })
export type ApproveInput = z.infer<typeof approveSchema>

export const closeSchema = z.object({
  id: z.string().uuid(),
  complete_service_ticket: z.boolean().default(false),
})
export type CloseInput = z.infer<typeof closeSchema>

export const cancelSchema = z.object({
  id: z.string().uuid(),
  notes: nullableStr,
})
export type CancelInput = z.infer<typeof cancelSchema>

export const unlockSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().min(1, 'Notes are required for unlock'),
})
export type UnlockInput = z.infer<typeof unlockSchema>

// --- Technician schemas ---

export const createTechnicianSchema = z.object({
  protocol_id: z.string().uuid(),
  staff_member_id: z.string().uuid(),
  date_from: optionalStr,
  date_to: optionalStr,
})
export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>

export const updateTechnicianSchema = z.object({
  id: z.string().uuid(),
  date_from: nullableStr,
  date_to: nullableStr,
  hours_worked: nonNegativeDecimal,
  km_driven: nonNegativeDecimal,
  delegation_days: nonNegativeInt,
  delegation_country: countryCodeSchema,
  hotel_invoice_ref: nullableStr,
  hotel_amount: nullableDecimal,
  // Coordinator-only fields (validated in command)
  is_billable: z.boolean().optional(),
  km_is_billable: z.boolean().optional(),
  hourly_rate_snapshot: nullableDecimal,
  km_rate_snapshot: nullableDecimal,
  diet_rate_snapshot: nullableDecimal,
})
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>

export const deleteTechnicianSchema = z.object({ id: z.string().uuid() })
export type DeleteTechnicianInput = z.infer<typeof deleteTechnicianSchema>

// --- Part schemas ---

export const createPartSchema = z.object({
  protocol_id: z.string().uuid(),
  catalog_product_id: nullableUuid,
  name_snapshot: z.string().min(1, 'Part name is required'),
  part_code_snapshot: optionalStr,
  quantity_proposed: nonNegativeDecimal,
  quantity_used: nonNegativeDecimal,
  unit: optionalStr,
  unit_price_snapshot: nullableDecimal,
  is_billable: z.boolean().optional(),
  line_status: partLineStatusSchema.optional(),
  notes: optionalStr,
})
export type CreatePartInput = z.infer<typeof createPartSchema>

export const updatePartSchema = z.object({
  id: z.string().uuid(),
  quantity_used: nonNegativeDecimal,
  line_status: partLineStatusSchema.optional(),
  notes: nullableStr,
  // Coordinator-only
  is_billable: z.boolean().optional(),
  unit_price_snapshot: nullableDecimal,
})
export type UpdatePartInput = z.infer<typeof updatePartSchema>

export const deletePartSchema = z.object({ id: z.string().uuid() })
export type DeletePartInput = z.infer<typeof deletePartSchema>
