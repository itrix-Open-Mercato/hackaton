import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TechnicianAvailability } from '../../../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['technicians.view'] },
  POST: { requireAuth: true, requireFeatures: ['technicians.edit'] },
  PUT: { requireAuth: true, requireFeatures: ['technicians.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['technicians.edit'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await buildContext(req)
    const { id: technicianId } = await params
    const em = ctx.container.resolve('em') as EntityManager
    const url = new URL(req.url)

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(400, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '100', 10)))
    const dateFrom = url.searchParams.get('dateFrom') ?? null
    const dateTo = url.searchParams.get('dateTo') ?? null
    const sortField = url.searchParams.get('sortField') ?? 'date'
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'DESC' : 'ASC'

    const where: FilterQuery<TechnicianAvailability> = {
      technicianId,
      tenantId: ctx.auth?.tenantId,
      organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId,
      deletedAt: null,
    } as FilterQuery<TechnicianAvailability>

    if (dateFrom) (where as any).date = { ...(where as any).date, $gte: dateFrom }
    if (dateTo) (where as any).date = { ...(where as any).date, $lte: dateTo }

    const [items, totalCount] = await em.findAndCount(TechnicianAvailability, where, {
      orderBy: { [sortField]: sortDir } as any,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

    return NextResponse.json({
      items: items.map((a) => ({
        id: a.id,
        technician_id: a.technicianId,
        date: typeof a.date === 'string' ? a.date : String(a.date).slice(0, 10),
        day_type: a.dayType,
        notes: a.notes ?? null,
        created_at: a.createdAt?.toISOString?.() ?? null,
        updated_at: a.updatedAt?.toISOString?.() ?? null,
      })),
      totalCount,
      page,
      pageSize,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.availability.list failed', err)
    return NextResponse.json({ error: 'Failed to list availability' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await buildContext(req)
    const { id: technicianId } = await params
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('technicians.availability.create', {
      input: { ...body, technician_id: technicianId },
      ctx,
    })
    return NextResponse.json({ id: String((result as any)?.id ?? '') })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.availability.create failed', err)
    return NextResponse.json({ error: 'Failed to create availability record' }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('technicians.availability.update', {
      input: body,
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.availability.update failed', err)
    return NextResponse.json({ error: 'Failed to update availability record' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await buildContext(req)
    const url = new URL(req.url)
    const availId = url.searchParams.get('id')
    if (!availId) throw new CrudHttpError(400, { error: 'Availability record id required' })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('technicians.availability.delete', {
      input: { id: availId },
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.availability.delete failed', err)
    return NextResponse.json({ error: 'Failed to delete availability record' }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Technicians',
  summary: 'Technician availability',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: {
    GET: {
      summary: 'List availability records for a technician',
      responses: [{ status: 200, description: 'Paginated list of availability records' }],
    },
    POST: {
      summary: 'Create an availability record for a technician',
      responses: [{ status: 200, description: 'Availability record created' }],
    },
    PUT: {
      summary: 'Update an availability record',
      responses: [{ status: 200, description: 'Availability record updated' }],
    },
    DELETE: {
      summary: 'Delete an availability record',
      responses: [{ status: 200, description: 'Availability record deleted' }],
    },
  },
}
