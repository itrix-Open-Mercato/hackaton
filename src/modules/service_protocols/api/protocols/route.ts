import { z } from 'zod'
import { NextResponse } from 'next/server'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ServiceProtocol } from '../../data/entities'
import {
  createProtocolCrudOpenApi,
  createProtocolPagedListResponseSchema,
  protocolCreatedSchema,
  protocolOkSchema,
  protocolListItemSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    serviceTicketId: z.string().uuid().optional(),
    status: z.string().optional(),
    customerEntityId: z.string().uuid().optional(),
    machineAssetId: z.string().uuid().optional(),
    staffMemberId: z.string().uuid().optional(),
    search: z.string().optional(),
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
    GET: { requireAuth: true, requireFeatures: ['service_protocols.view'] },
    POST: { requireAuth: true, requireFeatures: ['service_protocols.create'] },
    PUT: { requireAuth: true, requireFeatures: ['service_protocols.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['service_protocols.delete'] },
  },
  orm: {
    entity: ServiceProtocol,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: querySchema,
    fields: [
      'id',
      'protocol_number',
      'service_ticket_id',
      'status',
      'type',
      'customer_entity_id',
      'contact_person_id',
      'machine_asset_id',
      'ticket_description_snapshot',
      'planned_visit_date_snapshot',
      'planned_visit_end_date_snapshot',
      'work_description',
      'technician_notes',
      'customer_notes',
      'is_active',
      'closed_at',
      'created_by_user_id',
      'tenant_id',
      'organization_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      id: 'id',
      protocolNumber: 'protocol_number',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      plannedVisitDateSnapshot: 'planned_visit_date_snapshot',
    },
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ids) F.id = { $in: q.ids.split(',') }
      if (q.serviceTicketId) F.service_ticket_id = q.serviceTicketId
      if (q.status) F.status = { $in: q.status.split(',') }
      if (q.customerEntityId) F.customer_entity_id = q.customerEntityId
      if (q.machineAssetId) F.machine_asset_id = q.machineAssetId

      if (q.search) {
        const escaped = escapeLikePattern(q.search)
        F.$or = [
          { protocol_number: { $ilike: `%${escaped}%` } },
          { work_description: { $ilike: `%${escaped}%` } },
        ]
      }

      return filters
    },
    transformItem: (item: BaseFields) => {
      const s = item as Record<string, unknown>
      const str = (c: string, k: string) => String(s[c] ?? s[k] ?? '')
      const nullable = (c: string, k: string) => (s[c] ?? s[k] ?? null) as string | null
      const date = (c: string, k: string) => {
        const v = s[c] ?? s[k]
        return v ? new Date(v as string | number).toISOString() : null
      }
      return {
        id: str('id', 'id'),
        protocolNumber: str('protocolNumber', 'protocol_number'),
        serviceTicketId: str('serviceTicketId', 'service_ticket_id'),
        status: str('status', 'status'),
        type: str('type', 'type'),
        customerEntityId: nullable('customerEntityId', 'customer_entity_id'),
        contactPersonId: nullable('contactPersonId', 'contact_person_id'),
        machineAssetId: nullable('machineAssetId', 'machine_asset_id'),
        ticketDescriptionSnapshot: nullable('ticketDescriptionSnapshot', 'ticket_description_snapshot'),
        plannedVisitDateSnapshot: date('plannedVisitDateSnapshot', 'planned_visit_date_snapshot'),
        plannedVisitEndDateSnapshot: date('plannedVisitEndDateSnapshot', 'planned_visit_end_date_snapshot'),
        workDescription: nullable('workDescription', 'work_description'),
        technicianNotes: nullable('technicianNotes', 'technician_notes'),
        customerNotes: nullable('customerNotes', 'customer_notes'),
        isActive: Boolean(s.isActive ?? s.is_active ?? true),
        closedAt: date('closedAt', 'closed_at'),
        createdByUserId: nullable('createdByUserId', 'created_by_user_id'),
        tenantId: (s.tenantId ?? s.tenant_id ?? '') as string,
        organizationId: (s.organizationId ?? s.organization_id ?? '') as string,
        createdAt: date('createdAt', 'created_at'),
        updatedAt: date('updatedAt', 'updated_at'),
      }
    },
  },
  actions: {
    create: {
      commandId: 'service_protocols.protocols.create_from_ticket',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({
        id: String(result.id),
        protocolNumber: String(result.protocolNumber),
        status: String(result.status),
        serviceTicketId: String(result.serviceTicketId),
      }),
      status: 201,
    },
    update: {
      commandId: 'service_protocols.protocols.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true as const }),
    },
    delete: {
      commandId: 'service_protocols.protocols.cancel',
      response: () => ({ ok: true as const }),
    },
  },
})

export const openApi: OpenApiRouteDoc = createProtocolCrudOpenApi({
  resourceName: 'Service Protocol',
  pluralName: 'Service Protocols',
  querySchema,
  listResponseSchema: createProtocolPagedListResponseSchema(protocolListItemSchema),
  create: {
    schema: z.object({ service_ticket_id: z.string().uuid() }),
    description: 'Creates a service protocol from a service ticket.',
    responseSchema: protocolCreatedSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing protocol.',
    responseSchema: protocolOkSchema,
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    description: 'Cancels a protocol.',
    responseSchema: protocolOkSchema,
  },
})
