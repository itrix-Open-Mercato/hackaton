import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { TechnicianReservationTechnician } from '../../../data/entities'
import { createPagedListResponseSchema } from '../../openapi'
import { TECHNICIAN_SCHEDULE_ASSIGNMENT_ENTITY_TYPE } from '../../../lib/crud'

const F = {
  id: 'id',
  reservation_id: 'reservation_id',
  technician_id: 'technician_id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['technician_schedule.view'] },
}

const listSchema = z.object({
  reservationId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
}).passthrough()

type AssignmentRow = {
  id: string
  reservation_id: string
  technician_id: string
  organization_id: string
  tenant_id: string
  created_at: Date
  updated_at: Date
}

const { GET } = makeCrudRoute({
  metadata,
  orm: {
    entity: TechnicianReservationTechnician,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  list: {
    schema: listSchema,
    entityId: TECHNICIAN_SCHEDULE_ASSIGNMENT_ENTITY_TYPE,
    fields: [F.id, F.reservation_id, F.technician_id, F.organization_id, F.tenant_id, F.created_at, F.updated_at],
    sortFieldMap: {
      created_at: F.created_at,
      updated_at: F.updated_at,
    },
    buildFilters: (query) => ({
      [F.reservation_id]: query.reservationId,
    }),
    transformItem: (item: AssignmentRow) => ({
      ...item,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    }),
  },
})

export { GET }

export const openApi: OpenApiRouteDoc = {
  tag: 'TechnicianSchedule',
  summary: 'List reservation technicians',
  methods: {
    GET: {
      summary: 'List reservation technicians',
      query: listSchema,
      responses: [
        {
          status: 200,
          description: 'Paged list of technicians assigned to a reservation',
          schema: createPagedListResponseSchema(z.object({
            id: z.string().uuid(),
            reservation_id: z.string().uuid(),
            technician_id: z.string().uuid(),
            organization_id: z.string().uuid(),
            tenant_id: z.string().uuid(),
            created_at: z.string(),
            updated_at: z.string(),
          })),
        },
      ],
    },
  },
}
