import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { MachineCatalogServiceTypePart } from '../../data/entities'
import { machineCatalogServiceTypePartCreateSchema, machineCatalogServiceTypePartUpdateSchema } from '../../data/validators'
import '../../commands/machine-catalog'

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(100),
  machineServiceTypeId: z.string().uuid().optional(),
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
    entity: MachineCatalogServiceTypePart,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: null,
  },
  list: {
    schema: listSchema,
    fields: [
      'id', 'tenant_id', 'organization_id',
      'machine_service_type_id', 'catalog_product_id',
      'quantity', 'sort_order', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      sortOrder: 'sort_order',
      createdAt: 'created_at',
    },
    buildFilters: async (query, _ctx) => {
      const filters: Record<string, unknown> = {}
      if (query.machineServiceTypeId) filters['machine_service_type_id'] = query.machineServiceTypeId
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'machine_catalog.service_type_parts.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogServiceTypePartCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'machine_catalog.service_type_parts.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogServiceTypePartUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'machine_catalog.service_type_parts.delete',
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
  summary: 'Machine catalog service type parts CRUD',
  tags: ['Machine Catalog'],
}
