import { z } from 'zod'
import { serviceTypeSchema, ticketPrioritySchema } from './validators'

const discrepancySchema = z.object({
  type: z.string(),
  message: z.string(),
})

export const createServiceTicketPayloadSchema = z.object({
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  customer_entity_id: z.string().uuid().optional(),
  machine_hints: z.array(z.string()).optional(),
  machine_instance_id: z.string().uuid().optional(),
  service_type: serviceTypeSchema.optional(),
  priority: ticketPrioritySchema.default('normal'),
  description: z.string().min(1, 'Description is required'),
  address: z.string().optional(),
  contact_person_id: z.string().uuid().optional(),
  _confidence: z.number().min(0).max(1).optional(),
  _discrepancies: z.array(discrepancySchema).optional(),
  _customer_name: z.string().optional(),
  _machine_label: z.string().optional(),
})

export type CreateServiceTicketPayload = z.infer<typeof createServiceTicketPayloadSchema>
