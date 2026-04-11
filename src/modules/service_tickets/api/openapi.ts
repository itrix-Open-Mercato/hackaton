import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export const serviceTicketTag = 'Service Tickets'

export const serviceTicketOkSchema = z.object({
  ok: z.literal(true),
})

export const serviceTicketCreatedSchema = z.object({
  id: z.string().uuid(),
})

export const ticketListItemSchema = z
  .object({
    id: z.string(),
    ticket_number: z.string(),
    service_type: z.string(),
    status: z.string(),
    priority: z.string(),
    description: z.string().nullable().optional(),
    visit_date: z.string().nullable().optional(),
    visit_end_date: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    location_source: z.enum(['geocoded', 'manual']).nullable().optional(),
    geocoded_address: z.string().nullable().optional(),
    customer_entity_id: z.string().nullable().optional(),
    contact_person_id: z.string().nullable().optional(),
    machine_instance_id: z.string().nullable().optional(),
    order_id: z.string().nullable().optional(),
    created_by_user_id: z.string().nullable().optional(),
    tenant_id: z.string().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough()

export const ticketMapItemSchema = z.object({
  id: z.string().uuid(),
  ticketNumber: z.string(),
  status: z.string(),
  serviceType: z.string(),
  priority: z.string(),
  visitDate: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
})

export const ticketMapSummarySchema = z.object({
  totalFiltered: z.number(),
  mapped: z.number(),
  unmapped: z.number(),
  cappedAt: z.number(),
  truncated: z.boolean(),
})

export const ticketMapResponseSchema = z.object({
  items: z.array(ticketMapItemSchema),
  summary: ticketMapSummarySchema,
})

export const partListItemSchema = z
  .object({
    id: z.string(),
    ticket_id: z.string(),
    product_id: z.string(),
    quantity: z.number(),
    notes: z.string().nullable().optional(),
    tenant_id: z.string().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough()

export function createServiceTicketPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildServiceTicketCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: serviceTicketTag,
  defaultCreateResponseSchema: serviceTicketCreatedSchema,
  defaultOkResponseSchema: serviceTicketOkSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createServiceTicketCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildServiceTicketCrudOpenApi(options)
}
