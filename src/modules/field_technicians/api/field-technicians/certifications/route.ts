import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { FieldTechnicianCertification } from '../../../data/entities'
import { fieldTechnicianCertificationCreateSchema, fieldTechnicianCertificationUpdateSchema } from '../../../data/validators'
import { fieldTechnicianCertificationCrudEvents, FIELD_TECHNICIAN_CERT_ENTITY_TYPE } from '../../../lib/crud'
import { buildFieldTechniciansCrudOpenApi, createPagedListResponseSchema } from '../../openapi'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'

const routeMetadata = {
  path: '/field-technicians/certifications',
  GET: { requireAuth: true, requireFeatures: ['field_technicians.view'] },
  POST: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['field_technicians.manage'] },
}

export { routeMetadata as metadata }

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  technicianId: z.string().uuid().optional(),
  ids: z.string().optional(),
  sortField: z.string().optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>

type CertRow = {
  id: string
  organization_id: string
  tenant_id: string
  technician_id: string
  name: string
  cert_type: string | null
  code: string | null
  issued_at: Date | null
  expires_at: Date | null
  issued_by: string | null
  notes: string | null
  created_at: Date
}

const rawBodySchema = z.object({}).passthrough()

const listFields = [
  'id',
  'organization_id',
  'tenant_id',
  'technician_id',
  'name',
  'cert_type',
  'code',
  'issued_at',
  'expires_at',
  'issued_by',
  'notes',
  'created_at',
]

const sortFieldMap: Record<string, string> = {
  id: 'id',
  name: 'name',
  expires_at: 'expires_at',
  issued_at: 'issued_at',
  created_at: 'created_at',
}

const { GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: FieldTechnicianCertification,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: fieldTechnicianCertificationCrudEvents,
  indexer: { entityType: FIELD_TECHNICIAN_CERT_ENTITY_TYPE },
  list: {
    schema: listSchema,
    entityId: FIELD_TECHNICIAN_CERT_ENTITY_TYPE,
    fields: listFields,
    sortFieldMap,
    buildFilters: (q: ListQuery): Where<CertRow> => {
      const filters: Where<CertRow> = {}
      const F = filters as Record<string, WhereValue>
      if (q.technicianId) F.technician_id = q.technicianId
      if (q.ids) {
        const ids = q.ids.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (ids.length > 0) F.id = { $in: ids }
      }
      return filters as Where<CertRow>
    },
    transformItem: (item: CertRow) => ({
      id: item.id,
      organization_id: item.organization_id,
      tenant_id: item.tenant_id,
      technician_id: item.technician_id,
      name: item.name,
      cert_type: item.cert_type,
      code: item.code,
      issued_at: item.issued_at ? item.issued_at.toISOString() : null,
      expires_at: item.expires_at ? item.expires_at.toISOString() : null,
      issued_by: item.issued_by,
      notes: item.notes,
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'field_technicians.certifications.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return fieldTechnicianCertificationCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({ id: String((result as { certificationId: string }).certificationId) }),
      status: 201,
    },
    update: {
      commandId: 'field_technicians.certifications.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return fieldTechnicianCertificationUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'field_technicians.certifications.delete',
      response: () => ({ ok: true }),
    },
  },
})

export { GET, POST, PUT, DELETE }

const certItemSchema = z.object({
  id: z.string(),
  technician_id: z.string(),
  name: z.string(),
  cert_type: z.string().nullable(),
  expires_at: z.string().nullable(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = buildFieldTechniciansCrudOpenApi({
  resourceName: 'FieldTechnicianCertification',
  pluralName: 'FieldTechnicianCertifications',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(certItemSchema),
  create: {
    schema: fieldTechnicianCertificationCreateSchema,
    description: 'Adds a certification or permission record for a technician.',
  },
  update: {
    schema: fieldTechnicianCertificationUpdateSchema,
    description: 'Updates an existing certification record.',
  },
  del: {
    schema: deleteSchema,
    description: 'Removes a certification record.',
  },
})
