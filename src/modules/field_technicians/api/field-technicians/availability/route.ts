import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { FieldTechnicianAvailability } from '../../../data/entities'
import {
  fieldTechnicianAvailabilityCreateSchema,
  fieldTechnicianAvailabilityUpdateSchema,
} from '../../../data/validators'
import {
  fieldTechnicianAvailabilityCrudEvents,
  FIELD_TECHNICIAN_AVAILABILITY_ENTITY_TYPE,
} from '../../../lib/crud'
import { buildFieldTechniciansCrudOpenApi, createPagedListResponseSchema } from '../../openapi'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'

const routeMetadata = {
  path: '/field-technicians/availability',
  GET: { requireAuth: true, requireFeatures: ['field_technicians.view'] },
  POST: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
}

export { routeMetadata as metadata }

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(400).default(100),
  technicianId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  ids: z.string().optional(),
  sortField: z.string().optional().default('date'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>

type AvailabilityRow = {
  id: string
  organization_id: string
  tenant_id: string
  technician_id: string
  date: string
  day_type: string
  notes: string | null
  created_at: Date
  updated_at: Date
}

const rawBodySchema = z.object({}).passthrough()

const listFields = [
  'id',
  'organization_id',
  'tenant_id',
  'technician_id',
  'date',
  'day_type',
  'notes',
  'created_at',
  'updated_at',
]

const sortFieldMap: Record<string, string> = {
  id: 'id',
  date: 'date',
  day_type: 'day_type',
  created_at: 'created_at',
}

const { GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: FieldTechnicianAvailability,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: fieldTechnicianAvailabilityCrudEvents,
  indexer: { entityType: FIELD_TECHNICIAN_AVAILABILITY_ENTITY_TYPE },
  list: {
    schema: listSchema,
    entityId: FIELD_TECHNICIAN_AVAILABILITY_ENTITY_TYPE,
    fields: listFields,
    sortFieldMap,
    buildFilters: (q: ListQuery): Where<AvailabilityRow> => {
      const filters: Where<AvailabilityRow> = {}
      const F = filters as Record<string, WhereValue>
      if (q.technicianId) F.technician_id = q.technicianId
      if (q.ids) {
        const ids = q.ids.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (ids.length > 0) F.id = { $in: ids }
      }
      if (q.dateFrom && q.dateTo) {
        F.date = { $gte: q.dateFrom, $lte: q.dateTo }
      } else if (q.dateFrom) {
        F.date = { $gte: q.dateFrom }
      } else if (q.dateTo) {
        F.date = { $lte: q.dateTo }
      }
      return filters as Where<AvailabilityRow>
    },
    transformItem: (item: AvailabilityRow) => ({
      id: item.id,
      organization_id: item.organization_id,
      tenant_id: item.tenant_id,
      technician_id: item.technician_id,
      date: (item.date instanceof Date ? item.date.toISOString() : String(item.date)).slice(0, 10),
      day_type: item.day_type,
      notes: item.notes,
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'field_technicians.availability.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return fieldTechnicianAvailabilityCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({ id: String((result as { availabilityId: string }).availabilityId) }),
      status: 201,
    },
    update: {
      commandId: 'field_technicians.availability.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return fieldTechnicianAvailabilityUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'field_technicians.availability.delete',
      response: () => ({ ok: true }),
    },
  },
})

export { GET, POST, PUT, DELETE }

const availabilityItemSchema = z.object({
  id: z.string(),
  technician_id: z.string(),
  date: z.string(),
  day_type: z.string(),
  notes: z.string().nullable(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = buildFieldTechniciansCrudOpenApi({
  resourceName: 'FieldTechnicianAvailability',
  pluralName: 'FieldTechnicianAvailabilities',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(availabilityItemSchema),
  create: {
    schema: fieldTechnicianAvailabilityCreateSchema,
    description: 'Creates an availability record for a specific day.',
  },
  update: {
    schema: fieldTechnicianAvailabilityUpdateSchema,
    description: 'Updates an existing availability record.',
  },
  del: {
    schema: deleteSchema,
    description: 'Removes an availability record (restores the day to default).',
  },
})
