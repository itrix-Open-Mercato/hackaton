import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { MachineInstance } from '../../data/entities'
import { machineInstanceCreateSchema, machineInstanceUpdateSchema } from '../../data/validators'
import '../../commands/machine-instances'

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  ids: z.string().optional(),
  customerCompanyId: z.string().uuid().optional(),
  warrantyStatus: z.string().optional(),
  isActive: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['machine_instances.view'] },
    POST: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
  },
  orm: {
    entity: MachineInstance,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id', 'tenant_id', 'organization_id', 'catalog_product_id',
      'instance_code', 'serial_number', 'customer_company_id',
      'site_name', 'location_label', 'contact_name', 'contact_phone',
      'manufactured_at', 'commissioned_at',
      'warranty_until', 'warranty_status',
      'last_inspection_at', 'next_inspection_at',
      'service_count', 'complaint_count', 'last_service_case_code',
      'requires_announcement', 'announcement_lead_time_hours',
      'instance_notes', 'is_active', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      instanceCode: 'instance_code',
      serialNumber: 'serial_number',
      commissionedAt: 'commissioned_at',
      nextInspectionAt: 'next_inspection_at',
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
          { instance_code: { $ilike: like } },
          { serial_number: { $ilike: like } },
          { site_name: { $ilike: like } },
          { location_label: { $ilike: like } },
          { contact_name: { $ilike: like } },
        ]
      }
      if (query.customerCompanyId) filters['customer_company_id'] = query.customerCompanyId
      if (query.warrantyStatus) filters['warranty_status'] = query.warrantyStatus
      if (typeof query.isActive === 'string') {
        filters['is_active'] = query.isActive === 'true'
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'machine_instances.machines.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineInstanceCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'machine_instances.machines.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(machineInstanceUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'machine_instances.machines.delete',
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
  summary: 'Machine instances CRUD',
  tags: ['Machine Instances'],
}
