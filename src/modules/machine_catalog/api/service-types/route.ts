import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { MachineCatalogServiceType } from '../../data/entities'
import { machineCatalogServiceTypeCreateSchema, machineCatalogServiceTypeUpdateSchema } from '../../data/validators'
import '../../commands/machine-catalog'

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  machineProfileId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['machine_catalog.view'] },
    POST: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
  },
  orm: {
    entity: MachineCatalogServiceType,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id', 'tenant_id', 'organization_id', 'machine_profile_id',
      'service_type', 'default_team_size', 'default_service_duration_minutes',
      'startup_notes', 'service_notes', 'sort_order',
      'created_at', 'updated_at',
    ],
    sortFieldMap: {
      serviceType: 'service_type',
      sortOrder: 'sort_order',
      createdAt: 'created_at',
    },
    buildFilters: async (query, _ctx) => {
      const filters: Record<string, unknown> = {}
      if (query.machineProfileId) filters['machine_profile_id'] = query.machineProfileId
      if (typeof query.search === 'string' && query.search.trim().length > 0) {
        const like = `%${escapeLikePattern(query.search.trim())}%`
        filters['service_type'] = { $ilike: like }
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'machine_catalog.service_types.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogServiceTypeCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'machine_catalog.service_types.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogServiceTypeUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'machine_catalog.service_types.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        return { id }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const openApi = {
  summary: 'Machine catalog service types CRUD',
  tags: ['Machine Catalog'],
}
