import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PhoneCall, PhoneCallSummaryVersion } from '../../../../data/entities'
import { buildPhoneCallContext, getScope } from '../../../../lib/apiContext'
import { phoneCallsTag } from '../../../../lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['phone_calls.service_ticket.create'] },
}

const prefillResponseSchema = z.object({
  phone_call_id: z.string().uuid(),
  service_type: z.string(),
  priority: z.string(),
  description: z.string(),
  address: z.string().nullable(),
  visit_date: z.string().nullable(),
  customer_entity_id: z.string().uuid().nullable(),
  contact_person_id: z.string().uuid().nullable(),
  machine_asset_id: z.string().uuid().nullable(),
})

function readServiceLabel(serviceData: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = serviceData?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = record.label
  if (typeof label === 'string' && label.trim()) return label.trim()
  return null
}

function readDateLabel(serviceData: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = readServiceLabel(serviceData, key)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 16)
}

function formatDateTime(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

function buildDescription(call: PhoneCall, summary: PhoneCallSummaryVersion | null): string {
  const serviceData = summary?.serviceData ?? null
  const problemDescription = readServiceLabel(serviceData, 'problemDescription')
  const additionalNotes = readServiceLabel(serviceData, 'additionalNotes')
  const machine = readServiceLabel(serviceData, 'machine')
  const base = [
    problemDescription || summary?.summaryText || 'Zgłoszenie utworzone z połączenia VOIP.',
    machine ? `Maszyna: ${machine}` : null,
    additionalNotes ? `Dodatkowe uwagi: ${additionalNotes}` : null,
    call.callerPhoneNumber ? `Telefon od: ${call.callerPhoneNumber}` : null,
    call.calleePhoneNumber ? `Telefon do: ${call.calleePhoneNumber}` : null,
    call.startedAt ? `Start rozmowy: ${formatDateTime(call.startedAt)}` : null,
    call.externalCallId ? `ID rozmowy: ${call.externalCallId}` : null,
  ]
  return base.filter(Boolean).join('\n')
}

export async function GET(req: Request, context: { params?: { id?: string } }) {
  try {
    const callId = context.params?.id
    if (!callId) throw new CrudHttpError(400, { error: 'Phone call id is required' })
    const { ctx } = await buildPhoneCallContext(req)
    const scope = getScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const call = await em.findOne(PhoneCall, {
      id: callId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<PhoneCall>)
    if (!call) throw new CrudHttpError(404, { error: 'Phone call not found' })

    const activeSummary = call.activeSummaryVersionId
      ? await em.findOne(PhoneCallSummaryVersion, {
        id: call.activeSummaryVersionId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        isActive: true,
        deletedAt: null,
      } as FilterQuery<PhoneCallSummaryVersion>)
      : null
    const serviceData = activeSummary?.serviceData ?? null

    return NextResponse.json({
      phone_call_id: call.id,
      service_type: 'regular',
      priority: call.status === 'missed' ? 'urgent' : 'normal',
      description: buildDescription(call, activeSummary),
      address: readServiceLabel(serviceData, 'serviceAddress'),
      visit_date: readDateLabel(serviceData, 'requestedDate'),
      customer_entity_id: call.customerEntityId ?? null,
      contact_person_id: call.contactPersonId ?? null,
      machine_asset_id: null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    const message = err instanceof Error && err.message ? err.message : 'Failed to build service ticket prefill'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Build service ticket prefill from phone call',
  methods: {
    GET: {
      summary: 'Build service ticket prefill from phone call and active summary',
      responses: [
        { status: 200, description: 'Service ticket prefill', schema: prefillResponseSchema },
        { status: 400, description: 'Invalid request', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Not found', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
