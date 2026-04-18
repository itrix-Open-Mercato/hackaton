import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { resolveTenantEncryptionService } from '@open-mercato/shared/lib/encryption/customFieldValues'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ticketCrudEvents, ticketCrudIndexer } from '../../commands/tickets'
import { ServiceTicket, ServiceTicketAssignment, ServiceTicketServiceType } from '../../data/entities'
import { ENTITY_TYPE } from '../../lib/constants'
import { loadTicketReservationSummaries } from '../../lib/ticketReservations'
import type { ServiceTicketListItem } from '../../types'
import {
  createServiceTicketCrudOpenApi,
  createServiceTicketPagedListResponseSchema,
  serviceTicketCreatedSchema,
  serviceTicketOkSchema,
  ticketListItemSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    status: z.string().optional(),
    service_type: z.string().optional(),
    priority: z.string().optional(),
    customer_entity_id: z.string().uuid().optional(),
    machine_instance_id: z.string().uuid().optional(),
    sales_channel_id: z.string().uuid().optional(),
    staff_member_id: z.string().uuid().optional(),
    search: z.string().optional(),
    visit_date_from: z.string().optional(),
    visit_date_to: z.string().optional(),
    created_at_from: z.string().optional(),
    created_at_to: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>
type BaseFields = Record<string, unknown>

function parseDateFilterBoundary(value: string, boundary: 'start' | 'end'): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return boundary === 'start'
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
  }

  return new Date(value)
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
    POST: { requireAuth: true, requireFeatures: ['service_tickets.create'] },
    PUT: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['service_tickets.delete'] },
  },
  orm: {
    entity: ServiceTicket,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: ticketCrudEvents,
  indexer: ticketCrudIndexer,
  list: {
    schema: querySchema,
    entityId: ENTITY_TYPE,
    fields: [
      'id',
      'ticket_number',
      'service_type',
      'status',
      'priority',
      'description',
      'visit_date',
      'visit_end_date',
      'address',
      'latitude',
      'longitude',
      'location_source',
      'geocoded_address',
      'customer_entity_id',
      'contact_person_id',
      'machine_instance_id',
      'order_id',
      'sales_channel_id',
      'created_by_user_id',
      'tenant_id',
      'organization_id',
      'created_at',
    ],
    sortFieldMap: {
      id: 'id',
      ticketNumber: 'ticket_number',
      serviceType: 'service_type',
      status: 'status',
      priority: 'priority',
      visitDate: 'visit_date',
      createdAt: 'created_at',
    },
    buildFilters: async (q: Query, ctx: any): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ids) F.id = { $in: q.ids.split(',') }
      if (q.status) F.status = { $in: q.status.split(',') }
      if (q.service_type) F.service_type = { $in: q.service_type.split(',') }
      if (q.priority) F.priority = { $in: q.priority.split(',') }
      if (q.customer_entity_id) F.customer_entity_id = q.customer_entity_id
      if (q.machine_instance_id) F.machine_instance_id = q.machine_instance_id
      if (q.sales_channel_id) F.sales_channel_id = q.sales_channel_id

      if (q.staff_member_id) {
        const em = ctx.container.resolve('em') as EntityManager
        const assignments = await em.find(
          ServiceTicketAssignment,
          { staffMemberId: q.staff_member_id } as FilterQuery<ServiceTicketAssignment>,
        )
        const ticketIds = assignments.map((a) => {
          const t = a.ticket
          return typeof t === 'string' ? t : t?.id
        }).filter((id): id is string => !!id)
        F.id = ticketIds.length > 0 ? { $in: ticketIds } : { $in: ['00000000-0000-0000-0000-000000000000'] }
      }

      if (q.search) {
        const escaped = escapeLikePattern(q.search)
        F.$or = [
          { ticket_number: { $ilike: `%${escaped}%` } },
          { description: { $ilike: `%${escaped}%` } },
        ]
      }

      if (q.visit_date_from || q.visit_date_to) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.visit_date_from) range.$gte = parseDateFilterBoundary(q.visit_date_from, 'start')
        if (q.visit_date_to) range.$lte = parseDateFilterBoundary(q.visit_date_to, 'end')
        F.visit_date = range
      }

      if (q.created_at_from || q.created_at_to) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.created_at_from) range.$gte = parseDateFilterBoundary(q.created_at_from, 'start')
        if (q.created_at_to) range.$lte = parseDateFilterBoundary(q.created_at_to, 'end')
        F.created_at = range
      }

      return filters
    },
    transformItem: (item: BaseFields): ServiceTicketListItem => {
      const source = item as Record<string, unknown>
      const str = (camelCase: string, snakeCase: string) => String(source[camelCase] ?? source[snakeCase] ?? '')
      const nullable = (camelCase: string, snakeCase: string) =>
        (source[camelCase] ?? source[snakeCase] ?? null) as string | null
      const date = (camelCase: string, snakeCase: string) => {
        const value = source[camelCase] ?? source[snakeCase]
        return value ? new Date(value as string | number).toISOString() : null
      }

      const numOrNull = (camel: string, snake: string): number | null => {
        const v = source[camel] ?? source[snake]
        return v != null ? Number(v) : null
      }

      return {
        id: str('id', 'id'),
        ticketNumber: str('ticketNumber', 'ticket_number'),
        serviceType: str('serviceType', 'service_type'),
        status: str('status', 'status'),
        priority: str('priority', 'priority'),
        description: nullable('description', 'description'),
        visitDate: date('visitDate', 'visit_date'),
        visitEndDate: date('visitEndDate', 'visit_end_date'),
        address: nullable('address', 'address'),
        latitude: numOrNull('latitude', 'latitude'),
        longitude: numOrNull('longitude', 'longitude'),
        locationSource: (source.locationSource ?? source.location_source ?? null) as 'geocoded' | 'manual' | null,
        geocodedAddress: nullable('geocodedAddress', 'geocoded_address'),
        customerEntityId: nullable('customerEntityId', 'customer_entity_id'),
        contactPersonId: nullable('contactPersonId', 'contact_person_id'),
        machineInstanceId: nullable('machineInstanceId', 'machine_instance_id'),
        orderId: nullable('orderId', 'order_id'),
        salesChannelId: nullable('salesChannelId', 'sales_channel_id'),
        createdByUserId: nullable('createdByUserId', 'created_by_user_id'),
        tenantId: (source.tenantId ?? source.tenant_id ?? '') as string,
        organizationId: (source.organizationId ?? source.organization_id ?? '') as string,
        createdAt: date('createdAt', 'created_at'),
      }
    },
  },
  hooks: {
    afterList: async (payload: unknown, ctx: any) => {
      const items = Array.isArray((payload as { items?: unknown[] })?.items)
        ? ((payload as { items: ServiceTicketListItem[] }).items)
        : []
      if (!items.length) return

      const em = ctx.container.resolve('em') as EntityManager
      const assignments = await em.find(
        ServiceTicketAssignment,
        {
          ticket: { id: { $in: items.map((item) => item.id) } },
          tenantId: ctx.auth?.tenantId ?? undefined,
          organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined,
        } as FilterQuery<ServiceTicketAssignment>,
      )

      const staffIdsByTicket = new Map<string, string[]>()
      for (const assignment of assignments) {
        const ticketId = typeof assignment.ticket === 'string' ? assignment.ticket : assignment.ticket?.id
        if (!ticketId) continue
        const next = staffIdsByTicket.get(ticketId) ?? []
        next.push(assignment.staffMemberId)
        staffIdsByTicket.set(ticketId, next)
      }

      // Service type assignments (table may not exist yet — skip gracefully)
      const stIdsByTicket = new Map<string, string[]>()
      try {
        const stAssignments = await em.find(
          ServiceTicketServiceType,
          {
            ticket: { id: { $in: items.map((item) => item.id) } },
          } as FilterQuery<ServiceTicketServiceType>,
        )
        for (const sta of stAssignments) {
          const ticketId = typeof sta.ticket === 'string' ? sta.ticket : sta.ticket?.id
          if (!ticketId) continue
          const next = stIdsByTicket.get(ticketId) ?? []
          next.push(sta.machineServiceTypeId)
          stIdsByTicket.set(ticketId, next)
        }
      } catch {
        // table doesn't exist yet — migration pending
      }

      const scope = {
        tenantId: ctx.auth?.tenantId ?? null,
        organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null,
      }

      // Resolve staff member display names via Knex (cross-module — no entity import)
      const allStaffIds = new Set<string>()
      for (const ids of staffIdsByTicket.values()) {
        for (const id of ids) allStaffIds.add(id)
      }
      const staffNameMap = new Map<string, string>()
      if (allStaffIds.size > 0) {
        try {
          const knex = em.getKnex()
          const staffRows: { id: string; display_name: string }[] = await knex('staff_team_members')
            .select('id', 'display_name')
            .whereIn('id', [...allStaffIds])
          for (const row of staffRows) {
            staffNameMap.set(row.id, row.display_name)
          }
        } catch {
          // fallback: leave names as UUIDs
        }
      }

      // Fetch and decrypt company names from customer_entities via raw Knex
      const customerEntityIds = [
        ...new Set(items.map((item) => item.customerEntityId).filter((id): id is string => !!id)),
      ]
      const nameMap = new Map<string, string>()
      if (customerEntityIds.length > 0) {
        const knex = em.getConnection().getKnex()
        const tenantId: string | undefined = ctx.auth?.tenantId ?? undefined
        const organizationId: string | undefined = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined
        const rows: { id: string; display_name: string }[] = await knex('customer_entities')
          .select('id', 'display_name')
          .whereIn('id', customerEntityIds)
          .modify((qb) => {
            if (organizationId) qb.andWhere({ organization_id: organizationId })
            if (tenantId) qb.andWhere({ tenant_id: tenantId })
          })
        const encryptionService = resolveTenantEncryptionService(em as any)
        for (const row of rows) {
          const decrypted = await encryptionService.decryptEntityPayload(
            'customers:customer_entity',
            row as Record<string, unknown>,
            tenantId ?? null,
            organizationId ?? null,
          )
          const name = (decrypted.display_name ?? row.display_name) as string | null
          if (name) nameMap.set(row.id, name)
        }
      }

      for (const item of items) {
        const ids = staffIdsByTicket.get(item.id) ?? []
        item.staffMemberIds = ids
        ;(item as any).staffMemberNames = ids.map((id) => staffNameMap.get(id) ?? id)
        ;(item as any).machineServiceTypeIds = stIdsByTicket.get(item.id) ?? []
        item._service_tickets = {
          companyName: item.customerEntityId ? (nameMap.get(item.customerEntityId) ?? null) : null,
        }
      }

      if (scope.tenantId && scope.organizationId) {
        const reservationSummaries = await loadTicketReservationSummaries({
          em,
          ticketIds: items.map((item) => item.id),
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        })

        for (const item of items) {
          ;(item as any)._schedule = {
            reservations: reservationSummaries.get(item.id) ?? [],
          }
        }
      }
    },
  },
  actions: {
    create: {
      commandId: 'service_tickets.tickets.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'service_tickets.tickets.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'service_tickets.tickets.delete',
      response: () => ({ ok: true }),
    },
  },
})

const ticketDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createServiceTicketCrudOpenApi({
  resourceName: 'Service Ticket',
  pluralName: 'Service Tickets',
  querySchema,
  listResponseSchema: createServiceTicketPagedListResponseSchema(ticketListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a service ticket record.',
    responseSchema: serviceTicketCreatedSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing service ticket by id.',
    responseSchema: serviceTicketOkSchema,
  },
  del: {
    schema: ticketDeleteSchema,
    description: 'Deletes a service ticket by id (soft delete).',
    responseSchema: serviceTicketOkSchema,
  },
})
