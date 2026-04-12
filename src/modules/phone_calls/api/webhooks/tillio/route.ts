import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { tillioWebhookSchema } from '../../../data/validators'
import { buildPhoneCallContext } from '../../../lib/apiContext'
import { phoneCallsTag } from '../../../lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['phone_calls.webhooks.ingest'] },
}

const responseSchema = z.object({
  id: z.string().uuid(),
  duplicate: z.boolean(),
})

export async function POST(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const body = await req.json().catch(() => ({}))
    const input = tillioWebhookSchema.parse(body)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('phone_calls.call.ingest', { input, ctx })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to ingest Tillio webhook'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Ingest Tillio webhook',
  methods: {
    POST: {
      summary: 'Ingest Tillio webhook payload',
      requestBody: { contentType: 'application/json', schema: tillioWebhookSchema },
      responses: [
        { status: 200, description: 'Webhook ingested', schema: responseSchema },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
