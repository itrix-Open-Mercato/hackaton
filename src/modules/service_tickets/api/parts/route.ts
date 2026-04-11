import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ServiceTicketPart } from '../../data/entities'
import {
  createServiceTicketCrudOpenApi,
  createServiceTicketPagedListResponseSchema,
  partListItemSchema,
  serviceTicketCreatedSchema,
  serviceTicketOkSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    ticket_id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  ticket_id: string
  product_id: string
  quantity: number
  notes: string | null
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
    POST: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
    PUT: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
  },
  orm: {
    entity: ServiceTicketPart,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  list: {
    schema: querySchema,
    fields: [
      'id',
      'ticket_id',
      'product_id',
      'quantity',
      'notes',
      'tenant_id',
      'organization_id',
      'created_at',
    ],
    sortFieldMap: {
      id: 'id',
      created_at: 'created_at',
      quantity: 'quantity',
    },
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ticket_id) F.ticket_id = q.ticket_id

      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      ticket_id: String(item.ticket_id),
      product_id: String(item.product_id),
      quantity: Number(item.quantity),
      notes: item.notes ?? null,
      tenant_id: item.tenant_id ?? null,
      organization_id: item.organization_id ?? null,
      created_at: item.created_at ? new Date(item.created_at).toISOString() : null,
    }),
  },
  actions: {
    create: {
      commandId: 'service_tickets.parts.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'service_tickets.parts.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'service_tickets.parts.delete',
      response: () => ({ ok: true }),
    },
  },
})

const partDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createServiceTicketCrudOpenApi({
  resourceName: 'Service Ticket Part',
  pluralName: 'Service Ticket Parts',
  querySchema,
  listResponseSchema: createServiceTicketPagedListResponseSchema(partListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Adds a part to a service ticket.',
    responseSchema: serviceTicketCreatedSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates a service ticket part by id.',
    responseSchema: serviceTicketOkSchema,
  },
  del: {
    schema: partDeleteSchema,
    description: 'Removes a part from a service ticket.',
    responseSchema: serviceTicketOkSchema,
  },
})
