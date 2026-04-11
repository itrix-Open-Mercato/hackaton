import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TechnicianSkill } from '../../../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['technicians.view'] },
  POST: { requireAuth: true, requireFeatures: ['technicians.edit'] },
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
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId

    const skills = await em.find(TechnicianSkill, {
      technician: { id: technicianId },
      tenantId,
      organizationId,
    } as FilterQuery<TechnicianSkill>)

    return NextResponse.json({
      items: skills.map((s) => ({ id: s.id, name: s.name })),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.skills.list failed', err)
    return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await buildContext(req)
    const technicianId = params.id
    const body = await req.json().catch(() => ({}))
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('technicians.skills.add', {
      input: { ...body, technician_id: technicianId },
      ctx,
    })
    return NextResponse.json({ id: String((result as any)?.id ?? '') }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.skills.add failed', err)
    return NextResponse.json({ error: 'Failed to add skill' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await buildContext(req)
    const url = new URL(req.url)
    const skillId = url.searchParams.get('id')
    if (!skillId) throw new CrudHttpError(400, { error: 'Skill id required' })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('technicians.skills.remove', {
      input: { id: skillId },
      ctx,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('technicians.skills.remove failed', err)
    return NextResponse.json({ error: 'Failed to remove skill' }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Technicians',
  summary: 'Technician skills',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: {
    GET: {
      summary: 'List skills for a technician',
      responses: [{ status: 200, description: 'List of skills' }],
    },
    POST: {
      summary: 'Add a skill to a technician',
      responses: [{ status: 201, description: 'Skill created' }],
    },
    DELETE: {
      summary: 'Remove a skill from a technician',
      responses: [{ status: 200, description: 'Skill removed' }],
    },
  },
}
