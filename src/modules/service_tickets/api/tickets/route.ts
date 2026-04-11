import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ticketCrudEvents, ticketCrudIndexer } from '../../commands/tickets'
import { ServiceTicket } from '../../data/entities'
import { ENTITY_TYPE } from '../../lib/constants'
import type { ServiceTicketListItem } from '../../types'
import {
  createServiceTicketCrudOpenApi,
  createServiceTicketPagedListResponseSchema,
  serviceTicketCreatedSchema,
  serviceTicketOkSchema,
  ticketListItemSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    status: z.string().optional(),
    service_type: z.string().optional(),
    priority: z.string().optional(),
    customer_entity_id: z.string().uuid().optional(),
    machine_instance_id: z.string().uuid().optional(),
    search: z.string().optional(),
    visit_date_from: z.string().optional(),
    visit_date_to: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>
type BaseFields = Record<string, unknown>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
    POST: { requireAuth: true, requireFeatures: ['service_tickets.create'] },
    PUT: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['service_tickets.delete'] },
  },
  orm: {
    entity: ServiceTicket,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: ticketCrudEvents,
  indexer: ticketCrudIndexer,
  list: {
    schema: querySchema,
    entityId: ENTITY_TYPE,
    fields: [
      'id',
      'ticket_number',
      'service_type',
      'status',
      'priority',
      'description',
      'visit_date',
      'visit_end_date',
      'address',
      'customer_entity_id',
      'contact_person_id',
      'machine_instance_id',
      'order_id',
      'created_by_user_id',
      'tenant_id',
      'organization_id',
      'created_at',
    ],
    sortFieldMap: {
      id: 'id',
      ticketNumber: 'ticket_number',
      serviceType: 'service_type',
      status: 'status',
      priority: 'priority',
      visitDate: 'visit_date',
      createdAt: 'created_at',
    },
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ids) F.id = { $in: q.ids.split(',') }
      if (q.status) F.status = { $in: q.status.split(',') }
      if (q.service_type) F.service_type = { $in: q.service_type.split(',') }
      if (q.priority) F.priority = { $in: q.priority.split(',') }
      if (q.customer_entity_id) F.customer_entity_id = q.customer_entity_id
      if (q.machine_instance_id) F.machine_instance_id = q.machine_instance_id

      if (q.search) {
        const escaped = escapeLikePattern(q.search)
        F.$or = [
          { ticket_number: { $ilike: `%${escaped}%` } },
          { description: { $ilike: `%${escaped}%` } },
        ]
      }

      if (q.visit_date_from || q.visit_date_to) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.visit_date_from) range.$gte = new Date(q.visit_date_from)
        if (q.visit_date_to) range.$lte = new Date(q.visit_date_to)
        F.visit_date = range
      }

      return filters
    },
    transformItem: (item: BaseFields): ServiceTicketListItem => {
      const source = item as Record<string, unknown>
      const str = (camelCase: string, snakeCase: string) => String(source[camelCase] ?? source[snakeCase] ?? '')
      const nullable = (camelCase: string, snakeCase: string) =>
        (source[camelCase] ?? source[snakeCase] ?? null) as string | null
      const date = (camelCase: string, snakeCase: string) => {
        const value = source[camelCase] ?? source[snakeCase]
        return value ? new Date(value as string | number).toISOString() : null
      }

      return {
        id: str('id', 'id'),
        ticketNumber: str('ticketNumber', 'ticket_number'),
        serviceType: str('serviceType', 'service_type'),
        status: str('status', 'status'),
        priority: str('priority', 'priority'),
        description: nullable('description', 'description'),
        visitDate: date('visitDate', 'visit_date'),
        visitEndDate: date('visitEndDate', 'visit_end_date'),
        address: nullable('address', 'address'),
        customerEntityId: nullable('customerEntityId', 'customer_entity_id'),
        contactPersonId: nullable('contactPersonId', 'contact_person_id'),
        machineInstanceId: nullable('machineInstanceId', 'machine_instance_id'),
        orderId: nullable('orderId', 'order_id'),
        createdByUserId: nullable('createdByUserId', 'created_by_user_id'),
        tenantId: (source.tenantId ?? source.tenant_id ?? '') as string,
        organizationId: (source.organizationId ?? source.organization_id ?? '') as string,
        createdAt: date('createdAt', 'created_at'),
      }
    },
  },
  actions: {
    create: {
      commandId: 'service_tickets.tickets.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'service_tickets.tickets.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'service_tickets.tickets.delete',
      response: () => ({ ok: true }),
    },
  },
})

const ticketDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createServiceTicketCrudOpenApi({
  resourceName: 'Service Ticket',
  pluralName: 'Service Tickets',
  querySchema,
  listResponseSchema: createServiceTicketPagedListResponseSchema(ticketListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a service ticket record.',
    responseSchema: serviceTicketCreatedSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing service ticket by id.',
    responseSchema: serviceTicketOkSchema,
  },
  del: {
    schema: ticketDeleteSchema,
    description: 'Deletes a service ticket by id (soft delete).',
    responseSchema: serviceTicketOkSchema,
  },
})
