import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CredentialsService } from '@open-mercato/core/modules/integrations/lib/credentials-service'
import { buildPhoneCallContext, getScope } from '../../../lib/apiContext'
import { TILLIO_INTEGRATION_ID } from '../../../lib/constants'
import { phoneCallsTag } from '../../../lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['integrations.manage'] },
}

const healthResponseSchema = z.object({
  configured: z.boolean(),
  callsTotal: z.number(),
  callsWithoutServiceTicket: z.number(),
  callsWithoutSummary: z.number(),
  callsRecordingPending: z.number(),
  failedIngestEvents24h: z.number(),
  oldestPendingIngestEventAt: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
})

async function scalarCount(query: unknown): Promise<number> {
  const row = await (query as { first: () => Promise<Record<string, unknown> | undefined> }).first()
  return Number(row?.count ?? 0)
}

function dateOrNull(value: unknown): string | null {
  if (!value) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const scope = getScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()
    const credentialsService = ctx.container.resolve('integrationCredentialsService') as CredentialsService
    const credentials = await credentialsService.resolve(TILLIO_INTEGRATION_ID, scope)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const baseCalls = () => knex('phone_calls')
      .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId })
      .whereNull('deleted_at')

    const [
      callsTotal,
      callsWithoutServiceTicket,
      callsWithoutSummary,
      callsRecordingPending,
      failedIngestEvents24h,
      oldestPendingIngestEvent,
      lastSynced,
    ] = await Promise.all([
      scalarCount(baseCalls().clone().count('id as count')),
      scalarCount(baseCalls().clone().whereNull('service_ticket_id').count('id as count')),
      scalarCount(baseCalls().clone().whereNull('active_summary_version_id').count('id as count')),
      scalarCount(baseCalls().clone().whereNull('recording_url').whereNull('recording_attachment_id').count('id as count')),
      scalarCount(knex('phone_call_ingest_events')
        .count('id as count')
        .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, status: 'failed' })
        .where('created_at', '>=', since24h)),
      knex('phone_call_ingest_events')
        .min('received_at as oldest')
        .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, status: 'received' })
        .first(),
      baseCalls().clone().max('last_synced_at as latest').first(),
    ])

    return NextResponse.json({
      configured: Boolean(credentials),
      callsTotal,
      callsWithoutServiceTicket,
      callsWithoutSummary,
      callsRecordingPending,
      failedIngestEvents24h,
      oldestPendingIngestEventAt: dateOrNull(oldestPendingIngestEvent?.oldest),
      lastSyncedAt: dateOrNull(lastSynced?.latest),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    const message = err instanceof Error && err.message ? err.message : 'Failed to read phone call health'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Phone call operational health',
  methods: {
    GET: {
      summary: 'Return operational health counters for phone calls',
      responses: [
        { status: 200, description: 'Phone call health snapshot', schema: healthResponseSchema },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
