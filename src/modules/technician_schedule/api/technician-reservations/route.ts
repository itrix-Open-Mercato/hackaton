import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'

function ensureDatetimeOffset(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value
  // Already has offset (Z or +/-HH:MM)
  if (/[Zz]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) return value
  // Append Z for UTC
  return value + 'Z'
}

function normalizeDatetimeFields(payload: Record<string, unknown>): Record<string, unknown> {
  const result = { ...payload }
  if ('startsAt' in result) result['startsAt'] = ensureDatetimeOffset(result['startsAt'])
  if ('endsAt' in result) result['endsAt'] = ensureDatetimeOffset(result['endsAt'])
  return result
}
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TechnicianReservation, TechnicianReservationTechnician } from '../../data/entities'
import { buildTechnicianScheduleCrudOpenApi, createPagedListResponseSchema } from '../openapi'
import {
  technicianReservationCreateSchema,
  technicianReservationUpdateSchema,
} from '../../data/validators'
import { TECHNICIAN_SCHEDULE_RESERVATION_ENTITY_TYPE } from '../../lib/crud'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  title: 'title',
  reservation_type: 'reservation_type',
  status: 'status',
  source_type: 'source_type',
  source_ticket_id: 'source_ticket_id',
  source_order_id: 'source_order_id',
  starts_at: 'starts_at',
  ends_at: 'ends_at',
  vehicle_id: 'vehicle_id',
  vehicle_label: 'vehicle_label',
  customer_name: 'customer_name',
  address: 'address',
  notes: 'notes',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  path: '/technician-reservations',
  GET: { requireAuth: true, requireFeatures: ['technician_schedule.view'] },
  POST: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
}

export { routeMetadata as metadata }

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  technicianId: z.string().uuid().optional(),
  reservationType: z.string().optional(),
  reservationTypes: z.string().optional(),
  status: z.string().optional(),
  startsAtFrom: z.string().datetime({ offset: true }).optional(),
  startsAtTo: z.string().datetime({ offset: true }).optional(),
  sourceTicketId: z.string().uuid().optional(),
  sourceOrderId: z.string().uuid().optional(),
  ids: z.string().optional(),
  sortField: z.string().optional().default('starts_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
}).passthrough()

type ReservationRow = {
  id: string
  organization_id: string
  tenant_id: string
  title: string
  reservation_type: string
  status: string
  source_type: string
  source_ticket_id: string | null
  source_order_id: string | null
  starts_at: Date
  ends_at: Date
  vehicle_id: string | null
  vehicle_label: string | null
  customer_name: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  technicians?: string[]
}

const listItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  reservation_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  source_type: z.string().nullable().optional(),
  source_ticket_id: z.string().uuid().nullable().optional(),
  source_order_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
  vehicle_label: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  technicians: z.array(z.string().uuid()).optional(),
  technician_names: z.array(z.string()).optional(),
})

const { GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TechnicianReservation,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: TECHNICIAN_SCHEDULE_RESERVATION_ENTITY_TYPE },
  list: {
    schema: listSchema,
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.title,
      F.reservation_type,
      F.status,
      F.source_type,
      F.source_ticket_id,
      F.source_order_id,
      F.starts_at,
      F.ends_at,
      F.vehicle_id,
      F.vehicle_label,
      F.customer_name,
      F.address,
      F.notes,
      F.is_active,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      starts_at: F.starts_at,
      ends_at: F.ends_at,
      created_at: F.created_at,
    },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}

      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        const ids = query.ids.split(',').map((value) => value.trim()).filter(Boolean)
        if (ids.length > 0) filters[F.id] = { $in: ids }
      }

      const requestedTypes = typeof query.reservationTypes === 'string' && query.reservationTypes.trim().length > 0
        ? query.reservationTypes.split(',').map((value) => value.trim()).filter(Boolean)
        : []
      if (requestedTypes.length > 0) {
        filters[F.reservation_type] = { $in: requestedTypes }
      } else if (query.reservationType) {
        filters[F.reservation_type] = query.reservationType
      }

      if (query.status) filters[F.status] = query.status
      if (query.sourceTicketId) filters[F.source_ticket_id] = query.sourceTicketId
      if (query.sourceOrderId) filters[F.source_order_id] = query.sourceOrderId
      if (query.startsAtFrom || query.startsAtTo) {
        const startsAtFilter: Record<string, string> = {}
        if (query.startsAtFrom) startsAtFilter.$gte = query.startsAtFrom
        if (query.startsAtTo) startsAtFilter.$lte = query.startsAtTo
        filters[F.starts_at] = startsAtFilter
      }

      if (query.technicianId) {
        const em = (ctx.container.resolve('em') as EntityManager).fork()
        const assignmentFilter: Record<string, unknown> = { technicianId: query.technicianId }
        const tenantId = ctx.auth?.tenantId ?? null
        const organizationIds = ctx.organizationIds ?? null
        const selectedOrganizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
        if (tenantId) assignmentFilter.tenantId = tenantId
        if (Array.isArray(organizationIds) && organizationIds.length > 0) {
          assignmentFilter.organizationId = { $in: organizationIds }
        } else if (selectedOrganizationId) {
          assignmentFilter.organizationId = selectedOrganizationId
        }
        const assignments = await findWithDecryption(
          em,
          TechnicianReservationTechnician,
          assignmentFilter,
          { fields: ['reservationId'] },
        )
        const reservationIds = assignments.map((assignment) => assignment.reservationId)
        const existingIdFilter = filters[F.id]
        const filteredReservationIds = reservationIds.length > 0 ? reservationIds : []

        if (
          existingIdFilter &&
          typeof existingIdFilter === 'object' &&
          !Array.isArray(existingIdFilter) &&
          Array.isArray((existingIdFilter as { $in?: unknown }).$in)
        ) {
          const existingIds = (existingIdFilter as { $in: unknown[] }).$in
            .filter((value): value is string => typeof value === 'string')
          filters[F.id] = { $in: existingIds.filter((id) => filteredReservationIds.includes(id)) }
        } else {
          filters[F.id] = { $in: filteredReservationIds }
        }
      }

      return filters
    },
    transformItem: (item: ReservationRow) => ({
      ...item,
      technicians: Array.isArray(item.technicians) ? item.technicians : [],
      technician_names: Array.isArray((item as ReservationRow & { technician_names?: string[] }).technician_names)
        ? (item as ReservationRow & { technician_names?: string[] }).technician_names
        : [],
      starts_at: item.starts_at instanceof Date ? item.starts_at.toISOString() : item.starts_at,
      ends_at: item.ends_at instanceof Date ? item.ends_at.toISOString() : item.ends_at,
      created_at: item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at,
      updated_at: item.updated_at instanceof Date ? item.updated_at.toISOString() : item.updated_at,
    }),
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items)
        ? (payload.items as Array<Record<string, unknown>>)
        : []
      if (items.length === 0) return

      const reservationIds = items
        .map((item) => (typeof item.id === 'string' ? item.id : null))
        .filter((value): value is string => Boolean(value))

      if (reservationIds.length === 0) return

      const em = (ctx.container.resolve('em') as EntityManager).fork()
      const assignments = await findWithDecryption(
        em,
        TechnicianReservationTechnician,
        { reservationId: { $in: reservationIds } },
        { fields: ['reservationId', 'technicianId'] },
      )

      const techniciansByReservation = new Map<string, string[]>()
      const allTechnicianIds = new Set<string>()
      assignments.forEach((assignment) => {
        const current = techniciansByReservation.get(assignment.reservationId) ?? []
        current.push(assignment.technicianId)
        techniciansByReservation.set(assignment.reservationId, current)
        allTechnicianIds.add(assignment.technicianId)
      })

      const technicianNameById = new Map<string, string>()
      if (allTechnicianIds.size > 0) {
        type TechnicianRow = {
          id: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
        }
        const knex = (em as any).getConnection().getKnex()
        const rows = await knex<TechnicianRow>('technicians')
          .select('id', 'display_name', 'first_name', 'last_name')
          .whereIn('id', [...allTechnicianIds])
        rows.forEach((row) => {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
          technicianNameById.set(row.id, row.display_name ?? fullName ?? row.id)
        })
      }

      items.forEach((item) => {
        const reservationId = typeof item.id === 'string' ? item.id : null
        const technicianIds = reservationId ? (techniciansByReservation.get(reservationId) ?? []) : []
        item.technicians = technicianIds
        item.technician_names = technicianIds.map((id) => technicianNameById.get(id) ?? id)
      })
    },
  },
  actions: {
    create: {
      commandId: 'technician_schedule.reservation.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const normalized = normalizeDatetimeFields((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>)
        return parseScopedCommandInput(technicianReservationCreateSchema, normalized, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.reservationId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'technician_schedule.reservation.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const normalized = normalizeDatetimeFields((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>)
        return parseScopedCommandInput(technicianReservationUpdateSchema, normalized, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'technician_schedule.reservation.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(parsed, ctx, translate) }
      },
      response: () => ({ ok: true }),
    },
  },
})

export { GET, POST, PUT, DELETE }

export const openApi: OpenApiRouteDoc = buildTechnicianScheduleCrudOpenApi({
  resourceName: 'Technician Reservation',
  pluralName: 'Technician Reservations',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(listItemSchema),
  create: {
    schema: technicianReservationCreateSchema,
    description: 'Creates a technician reservation.',
  },
  update: {
    schema: technicianReservationUpdateSchema,
    responseSchema: z.object({ ok: z.literal(true) }),
    description: 'Updates a technician reservation.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: z.object({ ok: z.literal(true) }),
    description: 'Soft-deletes a technician reservation.',
  },
})
