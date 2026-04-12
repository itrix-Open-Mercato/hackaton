import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['machine_catalog.view'] },
}

export async function GET(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const tenantId = auth.tenantId

    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? ''

    const em = container.resolve('em') as EntityManager
    // Cross-module Knex query — avoids Turbopack CJS async issue with ORM entity imports
    const knex = (em as any).getConnection().getKnex()

    const rows: { name: string }[] = await knex('technician_skills')
      .select('name')
      .where({ tenant_id: tenantId, organization_id: organizationId })
      .modify((qb: any) => {
        if (q.trim().length > 0) qb.whereILike('name', `%${q.trim()}%`)
      })
      .distinct('name')
      .orderBy('name', 'asc')
      .limit(20)

    return NextResponse.json({ items: rows.map((r) => r.name) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('machine_catalog.service_type_skills.suggest failed', err)
    return NextResponse.json({ error: 'Failed to suggest skills' }, { status: 500 })
  }
}

export const openApi = {
  summary: 'Autosuggest skill names from technician records',
  tags: ['Machine Catalog'],
}
