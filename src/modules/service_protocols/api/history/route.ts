import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { ServiceProtocolHistory } from '../../data/entities'
import { createProtocolCrudOpenApi } from '../openapi'

const querySchema = z
  .object({
    protocolId: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

type Query = z.infer<typeof querySchema>
type BaseFields = Record<string, unknown>

export const { metadata, GET } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['service_protocols.view'] },
  },
  orm: {
    entity: ServiceProtocolHistory,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  list: {
    schema: querySchema,
    fields: [
      'id', 'protocol_id', 'event_type', 'old_value', 'new_value',
      'performed_by_user_id', 'performed_at', 'notes',
      'tenant_id', 'organization_id', 'created_at',
    ],
    sortFieldMap: { performedAt: 'performed_at', createdAt: 'created_at' },
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
        eventType: (s.eventType ?? s.event_type ?? '') as string,
        oldValue: (s.oldValue ?? s.old_value ?? null) as Record<string, unknown> | null,
        newValue: (s.newValue ?? s.new_value ?? null) as Record<string, unknown> | null,
        performedByUserId: (s.performedByUserId ?? s.performed_by_user_id ?? null) as string | null,
        performedAt: s.performed_at ? new Date(s.performed_at as string).toISOString() : null,
        notes: (s.notes ?? null) as string | null,
        tenantId: (s.tenantId ?? s.tenant_id ?? '') as string,
        organizationId: (s.organizationId ?? s.organization_id ?? '') as string,
        createdAt: s.created_at ? new Date(s.created_at as string).toISOString() : null,
      }
    },
  },
})

export const openApi: OpenApiRouteDoc = createProtocolCrudOpenApi({
  resourceName: 'Protocol History',
  pluralName: 'Protocol History Entries',
  querySchema,
  listResponseSchema: z.object({ items: z.array(z.object({}).passthrough()), totalCount: z.number().optional() }),
})
