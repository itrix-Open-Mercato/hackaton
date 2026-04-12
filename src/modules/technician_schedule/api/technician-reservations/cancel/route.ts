import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { cancelReservationSchema, type CancelReservationInput } from '../../../data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
}

async function buildContext(
  req: Request,
): Promise<{ ctx: CommandRuntimeContext; translate: (key: string, fallback?: string) => string }> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()

  if (!auth) {
    throw new CrudHttpError(401, { error: translate('technicianSchedule.errors.unauthorized', 'Unauthorized') })
  }

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    ctx: {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    },
    translate,
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(cancelReservationSchema, body, ctx, translate)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute<CancelReservationInput, { reservationId: string }>(
      'technician_schedule.reservation.cancel',
      { input, ctx },
    )

    const response = NextResponse.json({ ok: true })
    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: logEntry.resourceKind ?? 'technician_schedule.reservation',
          resourceId: logEntry.resourceId ?? result?.reservationId ?? null,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }
    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }

    const { translate } = await resolveTranslations()
    console.error('technician_schedule.cancel failed', error)
    return NextResponse.json(
      { error: translate('technicianSchedule.errors.cancelFailed', 'Failed to cancel reservation.') },
      { status: 400 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'TechnicianSchedule',
  summary: 'Cancel reservation',
  methods: {
    POST: {
      summary: 'Cancel reservation',
      description: 'Marks an existing technician reservation as cancelled.',
      requestBody: {
        contentType: 'application/json',
        schema: cancelReservationSchema,
      },
      responses: [
        { status: 200, description: 'Reservation cancelled', schema: z.object({ ok: z.literal(true) }) },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 403, description: 'Forbidden', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Reservation not found', schema: z.object({ error: z.string() }) },
        { status: 422, description: 'Already cancelled', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
