import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { MachineCatalogPartTemplate } from '../../data/entities'
import { machineCatalogPartTemplateCreateSchema, machineCatalogPartTemplateUpdateSchema } from '../../data/validators'
import '../../commands/machine-catalog'

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  ids: z.string().optional(),
  machineProfileId: z.string().uuid().optional(),
  templateType: z.string().optional(),
  serviceContext: z.string().optional(),
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
    entity: MachineCatalogPartTemplate,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id', 'tenant_id', 'organization_id',
      'machine_profile_id', 'part_catalog_product_id',
      'template_type', 'service_context', 'kit_name',
      'part_name', 'part_code',
      'quantity_default', 'quantity_unit', 'sort_order',
      'notes', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      partName: 'part_name',
      partCode: 'part_code',
      sortOrder: 'sort_order',
      createdAt: 'created_at',
    },
    buildFilters: async (query, _ctx) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        const ids = query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0)
        if (ids.length > 0) filters['id'] = { $in: ids }
      }
      if (typeof query.search === 'string' && query.search.trim().length > 0) {
        const like = `%${escapeLikePattern(query.search.trim())}%`
        filters['part_name'] = { $ilike: like }
      }
      if (query.machineProfileId) filters['machine_profile_id'] = query.machineProfileId
      if (query.templateType) filters['template_type'] = query.templateType
      if (query.serviceContext) filters['service_context'] = query.serviceContext
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'machine_catalog.part_templates.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogPartTemplateCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'machine_catalog.part_templates.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineCatalogPartTemplateUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'machine_catalog.part_templates.delete',
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
  summary: 'Machine catalog part templates CRUD',
  tags: ['Machine Catalog'],
}
