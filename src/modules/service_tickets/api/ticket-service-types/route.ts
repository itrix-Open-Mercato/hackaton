import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ServiceTicketServiceType } from '../../data/entities'
import '../../commands/ticket-service-types'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
  POST: { requireAuth: true, requireFeatures: ['service_tickets.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['service_tickets.manage'] },
}

const querySchema = z.object({
  ticketId: z.string().uuid(),
})

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

export async function GET(req: Request) {
  try {
    const ctx = await buildContext(req)
    const url = new URL(req.url)
    const parsed = querySchema.parse({ ticketId: url.searchParams.get('ticketId') })

    const em = ctx.container.resolve('em') as EntityManager
    const rows = await em.find(ServiceTicketServiceType, {
      ticket: { id: parsed.ticketId },
    })

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        ticketId: parsed.ticketId,
        machineServiceTypeId: r.machineServiceTypeId,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('service_tickets.service_types.list failed', err)
    return NextResponse.json({ error: 'Failed to list service type assignments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('service_tickets.service_types.assign', {
      input: body,
      ctx,
    })
    return NextResponse.json({ id: String((result as any)?.id ?? '') }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('service_tickets.service_types.assign failed', err)
    return NextResponse.json({ error: 'Failed to assign service type' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await buildContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) throw new CrudHttpError(400, { error: 'Assignment id required' })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('service_tickets.service_types.unassign', {
      input: { id },
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('service_tickets.service_types.unassign failed', err)
    return NextResponse.json({ error: 'Failed to unassign service type' }, { status: 400 })
  }
}

export const openApi = {
  summary: 'Service ticket service type assignments',
  tags: ['Service Tickets'],
}
