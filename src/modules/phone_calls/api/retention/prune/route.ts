import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { retentionPruneSchema } from '../../../data/validators'
import { buildPhoneCallContext } from '../../../lib/apiContext'
import { phoneCallsTag } from '../../../lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['integrations.manage'] },
}

const retentionPruneResponseSchema = z.object({
  dryRun: z.boolean(),
  transcriptVersions: z.number(),
  summaryVersions: z.number(),
  ingestEvents: z.number(),
})

export async function POST(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const body = await req.json().catch(() => ({}))
    const input = retentionPruneSchema.parse(body)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('phone_calls.retention.prune', { input, ctx })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to prune phone call retention data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Prune phone call retention data',
  methods: {
    POST: {
      summary: 'Prune inactive transcript and summary versions plus old ingest events',
      requestBody: { contentType: 'application/json', schema: retentionPruneSchema },
      responses: [
        { status: 200, description: 'Retention prune result', schema: retentionPruneResponseSchema },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
