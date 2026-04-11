import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { FieldTechnician } from '../../data/entities'
import { fieldTechnicianCreateSchema, fieldTechnicianUpdateSchema } from '../../data/validators'
import { fieldTechnicianCrudEvents, FIELD_TECHNICIAN_ENTITY_TYPE } from '../../lib/crud'
import { buildFieldTechniciansCrudOpenApi, createPagedListResponseSchema } from '../openapi'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  display_name: 'display_name',
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  phone: 'phone',
  location_status: 'location_status',
  skills: 'skills',
  languages: 'languages',
  notes: 'notes',
  staff_member_id: 'staff_member_id',
  vehicle_id: 'vehicle_id',
  vehicle_label: 'vehicle_label',
  current_order_id: 'current_order_id',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  path: '/field-technicians',
  GET: { requireAuth: true, requireFeatures: ['field_technicians.view'] },
  POST: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
}

export { routeMetadata as metadata }

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  locationStatus: z.string().optional(),
  skills: z.string().optional(),
  isActive: z.string().optional(),
  ids: z.string().optional(),
  sortField: z.string().optional().default('display_name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>

type TechnicianRow = {
  id: string
  organization_id: string
  tenant_id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  location_status: string
  skills: string[]
  languages: string[]
  notes: string | null
  staff_member_id: string | null
  vehicle_id: string | null
  vehicle_label: string | null
  current_order_id: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

const rawBodySchema = z.object({}).passthrough()

const listFields = [
  F.id,
  F.organization_id,
  F.tenant_id,
  F.display_name,
  F.first_name,
  F.last_name,
  F.email,
  F.phone,
  F.location_status,
  F.skills,
  F.languages,
  F.notes,
  F.staff_member_id,
  F.vehicle_id,
  F.vehicle_label,
  F.current_order_id,
  F.is_active,
  F.created_at,
  F.updated_at,
]

const sortFieldMap: Record<string, string> = {
  id: F.id,
  display_name: F.display_name,
  first_name: F.first_name,
  last_name: F.last_name,
  location_status: F.location_status,
  email: F.email,
  is_active: F.is_active,
  created_at: F.created_at,
}

const { GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: FieldTechnician,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: fieldTechnicianCrudEvents,
  indexer: { entityType: FIELD_TECHNICIAN_ENTITY_TYPE },
  list: {
    schema: listSchema,
    entityId: FIELD_TECHNICIAN_ENTITY_TYPE,
    fields: listFields,
    sortFieldMap,
    buildFilters: (q: ListQuery): Where<TechnicianRow> => {
      const filters: Where<TechnicianRow> = {}
      const F2 = filters as Record<string, WhereValue>

      if (q.ids) {
        const ids = q.ids.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (ids.length > 0) F2.id = { $in: ids }
      }

      if (q.search) {
        const pattern = `%${escapeLikePattern(q.search)}%`
        F2.$or = [
          { display_name: { $ilike: pattern } },
          { email: { $ilike: pattern } },
          { phone: { $ilike: pattern } },
        ]
      }

      if (q.locationStatus) F2.location_status = q.locationStatus
      if (q.isActive !== undefined && q.isActive !== '') {
        F2.is_active = q.isActive === 'true' || q.isActive === '1'
      }

      return filters as Where<TechnicianRow>
    },
    transformItem: (item: TechnicianRow) => ({
      id: item.id,
      organization_id: item.organization_id,
      tenant_id: item.tenant_id,
      display_name: item.display_name,
      first_name: item.first_name,
      last_name: item.last_name,
      email: item.email,
      phone: item.phone,
      location_status: item.location_status,
      skills: Array.isArray(item.skills) ? item.skills : [],
      languages: Array.isArray(item.languages) ? item.languages : [],
      notes: item.notes,
      staff_member_id: item.staff_member_id,
      vehicle_id: item.vehicle_id,
      vehicle_label: item.vehicle_label,
      current_order_id: item.current_order_id,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'field_technicians.technicians.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate) as Record<string, unknown>
        if (!scoped.displayName) {
          const first = typeof scoped.firstName === 'string' ? scoped.firstName : ''
          const last = typeof scoped.lastName === 'string' ? scoped.lastName : ''
          scoped.displayName = [first, last].filter(Boolean).join(' ').trim() || 'Technician'
        }
        return fieldTechnicianCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({ id: String((result as { technicianId: string }).technicianId) }),
      status: 201,
    },
    update: {
      commandId: 'field_technicians.technicians.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return fieldTechnicianUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'field_technicians.technicians.delete',
      response: () => ({ ok: true }),
    },
  },
})

export { GET, POST, PUT, DELETE }

const technicianListItemSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  location_status: z.string(),
  email: z.string().nullable(),
  is_active: z.boolean(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = buildFieldTechniciansCrudOpenApi({
  resourceName: 'FieldTechnician',
  pluralName: 'FieldTechnicians',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(technicianListItemSchema),
  create: {
    schema: fieldTechnicianCreateSchema,
    description: 'Creates a field technician profile.',
  },
  update: {
    schema: fieldTechnicianUpdateSchema,
    description: 'Updates an existing field technician profile.',
  },
  del: {
    schema: deleteSchema,
    description: 'Soft-deletes a field technician profile.',
  },
})
