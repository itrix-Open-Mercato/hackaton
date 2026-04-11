import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { generateTranscriptSchema } from '../../../../data/validators'
import { buildPhoneCallContext } from '../../../../lib/apiContext'
import { phoneCallsTag } from '../../../../lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['phone_calls.summary.regenerate'] },
}

const responseSchema = z.object({ id: z.string().uuid() })

export async function POST(req: Request, context: { params?: { id?: string } }) {
  try {
    const callId = context.params?.id
    if (!callId) throw new CrudHttpError(400, { error: 'Phone call id is required' })
    const { ctx } = await buildPhoneCallContext(req)
    const body = await req.json().catch(() => ({}))
    const input = { ...generateTranscriptSchema.parse(body), id: callId }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('phone_calls.transcript.generate', { input, ctx })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to generate transcript'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Generate phone call transcript',
  methods: {
    POST: {
      summary: 'Generate transcript from Tillio',
      requestBody: { contentType: 'application/json', schema: generateTranscriptSchema },
      responses: [
        { status: 200, description: 'Transcript version created', schema: responseSchema },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Not found', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
