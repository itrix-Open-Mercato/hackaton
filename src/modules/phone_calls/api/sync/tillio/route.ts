import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { tillioSyncSchema, type TillioSyncInput } from '../../../data/validators'
import type { TillioSyncResult } from '../../../types'
import { buildPhoneCallContext } from '../../../lib/apiContext'
import { phoneCallsTag, tillioSyncResultSchema } from '../../../lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['integrations.manage'] },
}

export async function POST(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const body = await req.json().catch(() => ({}))
    const input = tillioSyncSchema.parse(body)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<TillioSyncInput, TillioSyncResult>('phone_calls.calls.sync_tillio', { input, ctx })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to sync Tillio calls'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Sync Tillio calls',
  methods: {
    POST: {
      summary: 'Pull calls from Tillio',
      requestBody: { contentType: 'application/json', schema: tillioSyncSchema },
      responses: [
        { status: 200, description: 'Sync result', schema: tillioSyncResultSchema },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
