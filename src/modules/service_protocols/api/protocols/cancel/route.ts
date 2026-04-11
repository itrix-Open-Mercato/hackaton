import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { validateCrudMutationGuard, runCrudMutationGuardAfterSuccess } from '@open-mercato/shared/lib/crud/mutation-guard'
import { cancelSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['service_protocols.manage'] },
}

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container, auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }
    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = cancelSchema.parse(body)

    const guardResult = await validateCrudMutationGuard(container, {
      tenantId: auth.tenantId, organizationId: ctx.selectedOrganizationId,
      userId: auth.userId, resourceKind: 'service_protocols.protocol',
      resourceId: parsed.id, operation: 'custom',
      requestMethod: req.method, requestHeaders: req.headers, mutationPayload: parsed,
    })
    if (guardResult && !guardResult.ok) return NextResponse.json(guardResult.body, { status: guardResult.status })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('service_protocols.protocols.cancel', { input: parsed, ctx })

    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(container, {
        tenantId: auth.tenantId, organizationId: ctx.selectedOrganizationId,
        userId: auth.userId, resourceKind: 'service_protocols.protocol',
        resourceId: parsed.id, operation: 'custom',
        requestMethod: req.method, requestHeaders: req.headers, metadata: guardResult.metadata ?? null,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 })
    console.error('service_protocols.protocols.cancel failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Service Protocols',
  summary: 'Cancel protocol',
  methods: {
    POST: {
      summary: 'Cancel a protocol',
      description: 'Moves protocol to cancelled status.',
      requestBody: { contentType: 'application/json', schema: cancelSchema },
      responses: [{ status: 200, description: 'Protocol cancelled', schema: z.object({ ok: z.boolean() }) }],
      errors: [{ status: 422, description: 'Cannot cancel closed protocol', schema: z.object({ error: z.string() }) }],
    },
  },
}
