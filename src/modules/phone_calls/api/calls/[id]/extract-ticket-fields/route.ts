import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PhoneCall, PhoneCallSummaryVersion, PhoneCallTranscriptVersion } from '../../../../data/entities'
import { buildPhoneCallContext, getScope } from '../../../../lib/apiContext'
import { phoneCallsTag } from '../../../../lib/openapi'
import { extractTicketFieldsFromText, isLlmConfigured } from '../../../../lib/transcriptExtraction'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['phone_calls.service_ticket.create'] },
}

const responseSchema = z.object({
  phone_call_id: z.string().uuid(),
  service_type: z.string(),
  priority: z.string(),
  description: z.string(),
  address: z.string().nullable(),
  visit_date: z.string().nullable(),
  customer_entity_id: z.string().uuid().nullable(),
  contact_person_id: z.string().uuid().nullable(),
  machine_instance_id: z.string().uuid().nullable(),
  sales_channel_id: z.string().uuid().nullable(),
  _llm_extracted: z.boolean(),
  _confidence: z.number().nullable(),
  _source: z.enum(['transcript', 'summary', 'basic']),
  _customer_name: z.string().nullable(),
  _contact_name: z.string().nullable(),
  _machine_info: z.string().nullable(),
})

function formatDateTime(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

function buildBasicDescription(call: PhoneCall, summaryText: string | null): string {
  const parts = [
    summaryText || 'Zgłoszenie utworzone z połączenia VOIP.',
    call.callerPhoneNumber ? `Telefon od: ${call.callerPhoneNumber}` : null,
    call.startedAt ? `Start rozmowy: ${formatDateTime(call.startedAt)}` : null,
    call.externalCallId ? `ID rozmowy: ${call.externalCallId}` : null,
  ]
  return parts.filter(Boolean).join('\n')
}

export async function POST(req: Request, context: { params?: { id?: string } }) {
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

    // Fetch active transcript and summary
    const [activeTranscript, activeSummary] = await Promise.all([
      call.activeTranscriptVersionId
        ? em.findOne(PhoneCallTranscriptVersion, {
          id: call.activeTranscriptVersionId,
          tenantId: scope.tenantId,
          isActive: true,
          deletedAt: null,
        } as FilterQuery<PhoneCallTranscriptVersion>)
        : null,
      call.activeSummaryVersionId
        ? em.findOne(PhoneCallSummaryVersion, {
          id: call.activeSummaryVersionId,
          tenantId: scope.tenantId,
          isActive: true,
          deletedAt: null,
        } as FilterQuery<PhoneCallSummaryVersion>)
        : null,
    ])

    // Determine text source for LLM — prefer transcript, fall back to summary text
    const transcriptText = activeTranscript?.content?.trim() || null
    const summaryText = activeSummary?.summaryText?.trim() || null
    const extractionText = transcriptText ?? summaryText
    const extractionSource: 'transcript' | 'summary' = transcriptText ? 'transcript' : 'summary'

    // If LLM is configured and we have text → run extraction
    if (isLlmConfigured() && extractionText) {
      const extracted = await extractTicketFieldsFromText(extractionText, extractionSource)

      return NextResponse.json({
        phone_call_id: call.id,
        service_type: extracted.service_type,
        priority: extracted.priority,
        description: extracted.description,
        address: extracted.address,
        visit_date: extracted.visit_date,
        customer_entity_id: call.customerEntityId ?? null,
        contact_person_id: call.contactPersonId ?? null,
        machine_instance_id: null,
        sales_channel_id: null,
        _llm_extracted: true,
        _confidence: extracted.confidence,
        _source: extractionSource,
        _customer_name: extracted.customer_name,
        _contact_name: extracted.contact_name,
        _machine_info: extracted.machine_info,
      })
    }

    // Fallback — basic prefill without LLM (same logic as service-ticket-prefill GET)
    return NextResponse.json({
      phone_call_id: call.id,
      service_type: 'regular',
      priority: call.status === 'missed' ? 'urgent' : 'normal',
      description: buildBasicDescription(call, summaryText),
      address: null,
      visit_date: null,
      customer_entity_id: call.customerEntityId ?? null,
      contact_person_id: call.contactPersonId ?? null,
      machine_instance_id: null,
      sales_channel_id: null,
      _llm_extracted: false,
      _confidence: null,
      _source: 'basic',
      _customer_name: null,
      _contact_name: null,
      _machine_info: null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    const message = err instanceof Error && err.message ? err.message : 'Failed to extract ticket fields'
    console.error('[phone_calls:extract-ticket-fields]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Extract service ticket fields from call transcript using LLM',
  methods: {
    POST: {
      summary: 'Run LLM extraction on call transcript/summary to produce service ticket prefill. Falls back to basic prefill if LLM not configured.',
      responses: [
        { status: 200, description: 'Extracted ticket fields', schema: responseSchema },
        { status: 400, description: 'Invalid request', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Not found', schema: z.object({ error: z.string() }) },
        { status: 500, description: 'Extraction failed', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
