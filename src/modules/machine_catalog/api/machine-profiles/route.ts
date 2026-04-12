import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { MachineCatalogProfile } from '../../data/entities'
import { machineCatalogProfileCreateSchema, machineCatalogProfileUpdateSchema } from '../../data/validators'
import '../../commands/machine-catalog'

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  ids: z.string().optional(),
  catalogProductId: z.string().uuid().optional(),
  isActive: z.string().optional(),
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
    entity: MachineCatalogProfile,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id', 'tenant_id', 'organization_id', 'catalog_product_id',
      'machine_family', 'model_code',
      'preventive_maintenance_interval_days', 'default_warranty_months',
      'is_active', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      machineFamily: 'machine_family',
      modelCode: 'model_code',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query, _ctx) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        const ids = query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0)
        if (ids.length > 0) filters['id'] = { $in: ids }
      }
      if (typeof query.search === 'string' && query.search.trim().length > 0) {
        const like = `%${escapeLikePattern(query.search.trim())}%`
        filters['$or'] = [
          { machine_family: { $ilike: like } },
          { model_code: { $ilike: like } },
        ]
      }
      if (query.catalogProductId) filters['catalog_product_id'] = query.catalogProductId
      if (typeof query.isActive === 'string') {
        filters['is_active'] = query.isActive === 'true'
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'machine_catalog.profiles.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogProfileCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'machine_catalog.profiles.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogProfileUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'machine_catalog.profiles.delete',
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
  summary: 'Machine catalog profiles CRUD',
  tags: ['Machine Catalog'],
}
