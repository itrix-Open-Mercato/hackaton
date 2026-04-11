import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TechnicianCertification } from '../../../../data/entities'

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await buildContext(req)
    const technicianId = params.id
    const em = ctx.container.resolve('em') as EntityManager

    const certs = await em.find(TechnicianCertification, {
      technician: { id: technicianId },
      tenantId: ctx.auth?.tenantId,
      organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId,
    } as FilterQuery<TechnicianCertification>)

    const now = new Date()
    return NextResponse.json({
      items: certs.map((c) => ({
        id: c.id,
        name: c.name,
        certificateNumber: c.certificateNumber ?? null,
        issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        isExpired: c.expiresAt ? c.expiresAt < now : false,
      })),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.certifications.list failed', err)
    return NextResponse.json({ error: 'Failed to list certifications' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await buildContext(req)
    const technicianId = params.id
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('technicians.certifications.add', {
      input: { ...body, technician_id: technicianId },
      ctx,
    })
    return NextResponse.json({ id: String((result as any)?.id ?? '') }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.certifications.add failed', err)
    return NextResponse.json({ error: 'Failed to add certification' }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('technicians.certifications.update', {
      input: body,
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.certifications.update failed', err)
    return NextResponse.json({ error: 'Failed to update certification' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await buildContext(req)
    const url = new URL(req.url)
    const certId = url.searchParams.get('id')
    if (!certId) throw new CrudHttpError(400, { error: 'Certification id required' })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('technicians.certifications.remove', {
      input: { id: certId },
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.certifications.remove failed', err)
    return NextResponse.json({ error: 'Failed to remove certification' }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'List certifications for a technician',
    tags: ['Technicians'],
    responses: { 200: { description: 'List of certifications' } },
  },
  POST: {
    summary: 'Add a certification to a technician',
    tags: ['Technicians'],
    responses: { 201: { description: 'Certification created' } },
  },
  PUT: {
    summary: 'Update a certification',
    tags: ['Technicians'],
    responses: { 200: { description: 'Certification updated' } },
  },
  DELETE: {
    summary: 'Remove a certification from a technician',
    tags: ['Technicians'],
    responses: { 200: { description: 'Certification removed' } },
  },
}
