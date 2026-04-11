import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { ServiceTicket } from '../../../data/entities'
import { serviceTicketTag, ticketMapResponseSchema } from '../../openapi'
import type { ServiceTicketMapItem, TicketMapResponse } from '../../../types'

const MAP_ITEM_CAP = 2000

export const metadata = {
  GET: {
    requireAuth: true,
    requireFeatures: ['service_tickets.view'],
  },
}

const filterSchema = z.object({
  status: z.string().optional(),
  service_type: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
  visit_date_from: z.string().optional(),
  visit_date_to: z.string().optional(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuthFromRequest(request)
  if (!auth?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const url = new URL(request.url)
  const rawQuery = Object.fromEntries(url.searchParams.entries())
  const parseResult = filterSchema.safeParse(rawQuery)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid filter parameters', details: parseResult.error.flatten() }, { status: 422 })
  }

  const q = parseResult.data
  const organizationId = (request.headers.get('x-organization-id') ?? auth.orgId) ?? null

  // Build base filter conditions
  const conditions: string[] = [
    'st.tenant_id = :tenantId',
    'st.deleted_at IS NULL',
    'st.latitude IS NOT NULL',
    'st.longitude IS NOT NULL',
  ]
  const bindings: Record<string, unknown> = { tenantId: auth.tenantId }

  if (organizationId) {
    conditions.push('st.organization_id = :organizationId')
    bindings.organizationId = organizationId
  }

  if (q.status) {
    const statuses = q.status.split(',').filter(Boolean)
    conditions.push('st.status = ANY(:statuses)')
    bindings.statuses = statuses
  }

  if (q.service_type) {
    const types = q.service_type.split(',').filter(Boolean)
    conditions.push('st.service_type = ANY(:serviceTypes)')
    bindings.serviceTypes = types
  }

  if (q.priority) {
    const priorities = q.priority.split(',').filter(Boolean)
    conditions.push('st.priority = ANY(:priorities)')
    bindings.priorities = priorities
  }

  if (q.search) {
    const escaped = escapeLikePattern(q.search)
    conditions.push('(st.ticket_number ILIKE :search OR st.description ILIKE :search)')
    bindings.search = `%${escaped}%`
  }

  if (q.visit_date_from) {
    conditions.push('st.visit_date >= :visitDateFrom')
    bindings.visitDateFrom = new Date(q.visit_date_from)
  }

  if (q.visit_date_to) {
    conditions.push('st.visit_date <= :visitDateTo')
    bindings.visitDateTo = new Date(q.visit_date_to)
  }

  const whereClause = conditions.join(' AND ')

  // Count total filtered tickets (with and without coordinates)
  const countConditions = conditions
    .filter((c) => !c.includes('latitude IS NOT NULL') && !c.includes('longitude IS NOT NULL'))
    .join(' AND ')

  const knex = (em as unknown as { getConnection(): { getKnex(): ReturnType<typeof import('knex')> } }).getConnection().getKnex()

  const [totalRow] = await knex.raw(
    `SELECT COUNT(*)::int AS total FROM service_tickets st WHERE ${countConditions}`,
    bindings,
  ).then((r: { rows: Array<{ total: number }> }) => r.rows)

  const totalFiltered: number = totalRow?.total ?? 0

  // Fetch located tickets up to cap + 1 (to detect truncation)
  const rows = await knex.raw(
    `SELECT st.id, st.ticket_number, st.status, st.service_type, st.priority,
            st.visit_date, st.address, st.latitude, st.longitude
     FROM service_tickets st
     WHERE ${whereClause}
     ORDER BY st.created_at DESC
     LIMIT :limit`,
    { ...bindings, limit: MAP_ITEM_CAP + 1 },
  ).then((r: { rows: Array<Record<string, unknown>> }) => r.rows)

  const truncated = rows.length > MAP_ITEM_CAP
  const capped = truncated ? rows.slice(0, MAP_ITEM_CAP) : rows

  const items: ServiceTicketMapItem[] = capped.map((row) => ({
    id: String(row.id),
    ticketNumber: String(row.ticket_number),
    status: String(row.status) as ServiceTicketMapItem['status'],
    serviceType: String(row.service_type) as ServiceTicketMapItem['serviceType'],
    priority: String(row.priority) as ServiceTicketMapItem['priority'],
    visitDate: row.visit_date ? new Date(row.visit_date as string | number).toISOString() : null,
    address: row.address != null ? String(row.address) : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }))

  const mapped = items.length
  const unmapped = totalFiltered - (truncated ? totalFiltered : mapped)

  const response: TicketMapResponse = {
    items,
    summary: {
      totalFiltered,
      mapped,
      unmapped: Math.max(0, unmapped),
      cappedAt: MAP_ITEM_CAP,
      truncated,
    },
  }

  return NextResponse.json(response)
}

export const openApi: OpenApiRouteDoc = {
  tag: serviceTicketTag,
  summary: 'Service ticket map projection',
  methods: {
    GET: {
      summary: 'Map markers for filtered tickets',
      description:
        'Returns up to 2 000 located tickets as map markers plus a summary of mapped/unmapped counts. Accepts the same filter parameters as the tickets list endpoint (excluding pagination and sort).',
      tags: [serviceTicketTag],
      query: filterSchema,
      responses: [
        { status: 200, description: 'Map markers and summary.', schema: ticketMapResponseSchema },
      ],
      errors: [
        { status: 401, description: 'Authentication required.' },
        { status: 403, description: 'Missing service_tickets.view feature.' },
        { status: 422, description: 'Invalid filter parameter.' },
      ],
    },
  },
}
