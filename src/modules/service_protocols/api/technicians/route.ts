import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ServiceProtocolTechnician } from '../../data/entities'
import { createProtocolCrudOpenApi, protocolOkSchema } from '../openapi'

const querySchema = z
  .object({
    protocolId: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(100),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>
type BaseFields = Record<string, unknown>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['service_protocols.view'] },
    POST: { requireAuth: true, requireFeatures: ['service_protocols.edit'] },
    PUT: { requireAuth: true, requireFeatures: ['service_protocols.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['service_protocols.edit'] },
  },
  orm: {
    entity: ServiceProtocolTechnician,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: querySchema,
    fields: [
      'id', 'protocol_id', 'staff_member_id', 'date_from', 'date_to',
      'hours_worked', 'hourly_rate_snapshot', 'is_billable',
      'km_driven', 'km_rate_snapshot', 'km_is_billable',
      'delegation_days', 'delegation_country', 'diet_rate_snapshot',
      'hotel_invoice_ref', 'hotel_amount',
      'tenant_id', 'organization_id', 'created_at', 'updated_at',
    ],
    sortFieldMap: { id: 'id', createdAt: 'created_at' },
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.protocolId) F.protocol_id = q.protocolId
      return filters
    },
    transformItem: (item: BaseFields) => {
      const s = item as Record<string, unknown>
      return {
        id: String(s.id ?? ''),
        protocolId: (s.protocolId ?? s.protocol_id ?? '') as string,
        staffMemberId: (s.staffMemberId ?? s.staff_member_id ?? '') as string,
        dateFrom: (s.dateFrom ?? s.date_from ?? null) as string | null,
        dateTo: (s.dateTo ?? s.date_to ?? null) as string | null,
        hoursWorked: Number(s.hoursWorked ?? s.hours_worked ?? 0),
        hourlyRateSnapshot: s.hourlyRateSnapshot != null ? Number(s.hourlyRateSnapshot) : (s.hourly_rate_snapshot != null ? Number(s.hourly_rate_snapshot) : null),
        isBillable: Boolean(s.isBillable ?? s.is_billable ?? false),
        kmDriven: Number(s.kmDriven ?? s.km_driven ?? 0),
        kmRateSnapshot: s.kmRateSnapshot != null ? Number(s.kmRateSnapshot) : (s.km_rate_snapshot != null ? Number(s.km_rate_snapshot) : null),
        kmIsBillable: Boolean(s.kmIsBillable ?? s.km_is_billable ?? false),
        delegationDays: Number(s.delegationDays ?? s.delegation_days ?? 0),
        delegationCountry: (s.delegationCountry ?? s.delegation_country ?? null) as string | null,
        dietRateSnapshot: s.dietRateSnapshot != null ? Number(s.dietRateSnapshot) : (s.diet_rate_snapshot != null ? Number(s.diet_rate_snapshot) : null),
        hotelInvoiceRef: (s.hotelInvoiceRef ?? s.hotel_invoice_ref ?? null) as string | null,
        hotelAmount: s.hotelAmount != null ? Number(s.hotelAmount) : (s.hotel_amount != null ? Number(s.hotel_amount) : null),
        tenantId: (s.tenantId ?? s.tenant_id ?? '') as string,
        organizationId: (s.organizationId ?? s.organization_id ?? '') as string,
        createdAt: s.created_at ? new Date(s.created_at as string).toISOString() : null,
        updatedAt: s.updated_at ? new Date(s.updated_at as string).toISOString() : null,
      }
    },
  },
  actions: {
    create: {
      commandId: 'service_protocols.technicians.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'service_protocols.technicians.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true as const }),
    },
    delete: {
      commandId: 'service_protocols.technicians.delete',
      response: () => ({ ok: true as const }),
    },
  },
})

export const openApi: OpenApiRouteDoc = createProtocolCrudOpenApi({
  resourceName: 'Protocol Technician',
  pluralName: 'Protocol Technicians',
  querySchema,
  listResponseSchema: z.object({ items: z.array(z.object({}).passthrough()), totalCount: z.number().optional() }),
  create: {
    schema: rawBodySchema,
    description: 'Adds a technician line to a protocol.',
    responseSchema: z.object({ id: z.string().uuid() }),
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates a technician line.',
    responseSchema: protocolOkSchema,
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    description: 'Removes a technician line from a protocol.',
    responseSchema: protocolOkSchema,
  },
})
