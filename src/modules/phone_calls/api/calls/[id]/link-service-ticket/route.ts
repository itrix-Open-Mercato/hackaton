import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { linkServiceTicketSchema } from '../../../../data/validators'
import { buildPhoneCallContext } from '../../../../lib/apiContext'
import { okSchema, phoneCallsTag } from '../../../../lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['phone_calls.service_ticket.link'] },
}

export async function POST(req: Request, context: { params?: { id?: string } }) {
  try {
    const callId = context.params?.id
    if (!callId) throw new CrudHttpError(400, { error: 'Phone call id is required' })
    const { ctx } = await buildPhoneCallContext(req)
    const body = await req.json().catch(() => ({}))
    const input = { ...linkServiceTicketSchema.parse(body), id: callId }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('phone_calls.calls.link_service_ticket', { input, ctx })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to link service ticket'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Link phone call to service ticket',
  methods: {
    POST: {
      summary: 'Link phone call to service ticket',
      requestBody: { contentType: 'application/json', schema: linkServiceTicketSchema },
      responses: [
        { status: 200, description: 'Linked', schema: okSchema },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Not found', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
