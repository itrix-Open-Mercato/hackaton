import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ServiceProtocolPart } from '../../data/entities'
import { createProtocolCrudOpenApi, protocolOkSchema } from '../openapi'

const querySchema = z
  .object({
    protocolId: z.string().uuid().optional(),
    lineStatus: z.string().optional(),
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
    entity: ServiceProtocolPart,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: querySchema,
    fields: [
      'id', 'protocol_id', 'catalog_product_id', 'name_snapshot', 'part_code_snapshot',
      'quantity_proposed', 'quantity_used', 'unit', 'unit_price_snapshot',
      'is_billable', 'line_status', 'notes',
      'tenant_id', 'organization_id', 'created_at', 'updated_at',
    ],
    sortFieldMap: { id: 'id', createdAt: 'created_at' },
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.protocolId) F.protocol_id = q.protocolId
      if (q.lineStatus) F.line_status = { $in: q.lineStatus.split(',') }
      return filters
    },
    transformItem: (item: BaseFields) => {
      const s = item as Record<string, unknown>
      return {
        id: String(s.id ?? ''),
        protocolId: (s.protocolId ?? s.protocol_id ?? '') as string,
        catalogProductId: (s.catalogProductId ?? s.catalog_product_id ?? null) as string | null,
        nameSnapshot: (s.nameSnapshot ?? s.name_snapshot ?? '') as string,
        partCodeSnapshot: (s.partCodeSnapshot ?? s.part_code_snapshot ?? null) as string | null,
        quantityProposed: Number(s.quantityProposed ?? s.quantity_proposed ?? 0),
        quantityUsed: Number(s.quantityUsed ?? s.quantity_used ?? 0),
        unit: (s.unit ?? null) as string | null,
        unitPriceSnapshot: s.unitPriceSnapshot != null ? Number(s.unitPriceSnapshot) : (s.unit_price_snapshot != null ? Number(s.unit_price_snapshot) : null),
        isBillable: Boolean(s.isBillable ?? s.is_billable ?? false),
        lineStatus: (s.lineStatus ?? s.line_status ?? 'proposed') as string,
        notes: (s.notes ?? null) as string | null,
        tenantId: (s.tenantId ?? s.tenant_id ?? '') as string,
        organizationId: (s.organizationId ?? s.organization_id ?? '') as string,
        createdAt: s.created_at ? new Date(s.created_at as string).toISOString() : null,
        updatedAt: s.updated_at ? new Date(s.updated_at as string).toISOString() : null,
      }
    },
  },
  actions: {
    create: {
      commandId: 'service_protocols.parts.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'service_protocols.parts.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true as const }),
    },
    delete: {
      commandId: 'service_protocols.parts.delete',
      response: () => ({ ok: true as const }),
    },
  },
})

export const openApi: OpenApiRouteDoc = createProtocolCrudOpenApi({
  resourceName: 'Protocol Part',
  pluralName: 'Protocol Parts',
  querySchema,
  listResponseSchema: z.object({ items: z.array(z.object({}).passthrough()), totalCount: z.number().optional() }),
  create: {
    schema: rawBodySchema,
    description: 'Adds a part line to a protocol.',
    responseSchema: z.object({ id: z.string().uuid() }),
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates a part line.',
    responseSchema: protocolOkSchema,
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    description: 'Removes or marks a part line as removed.',
    responseSchema: protocolOkSchema,
  },
})
