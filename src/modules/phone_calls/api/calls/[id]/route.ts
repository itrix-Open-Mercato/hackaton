import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PhoneCall, PhoneCallSummaryVersion, PhoneCallTranscriptVersion } from '../../../data/entities'
import { buildPhoneCallContext, getScope } from '../../../lib/apiContext'
import { phoneCallsTag } from '../../../lib/openapi'
import type {
  PhoneCallDetail,
  PhoneCallListItem,
  PhoneCallSummaryVersionView,
  PhoneCallTranscriptVersionView,
} from '../../../types'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['integrations.view'] },
}

const jsonRecordSchema = z.record(z.string(), z.unknown())

const transcriptVersionSchema = z.object({
  id: z.string().uuid(),
  versionNo: z.number(),
  source: z.string(),
  languageCode: z.string().nullable(),
  content: z.string(),
  isActive: z.boolean(),
  qualityScore: z.string().nullable(),
  createdAt: z.string().nullable(),
})

const summaryVersionSchema = z.object({
  id: z.string().uuid(),
  transcriptVersionId: z.string().uuid().nullable(),
  versionNo: z.number(),
  generationType: z.string(),
  summaryText: z.string(),
  serviceData: jsonRecordSchema,
  manualOverrides: jsonRecordSchema.nullable(),
  fieldConfidence: jsonRecordSchema.nullable(),
  requiresReview: jsonRecordSchema.nullable(),
  promptVersion: z.string(),
  modelName: z.string(),
  isActive: z.boolean(),
  qualityStatus: z.string(),
  createdAt: z.string().nullable(),
})

const phoneCallDetailSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  externalCallId: z.string(),
  externalConversationId: z.string().nullable(),
  direction: z.string(),
  status: z.string(),
  callerPhoneNumber: z.string().nullable(),
  calleePhoneNumber: z.string().nullable(),
  assignedUserId: z.string().nullable(),
  customerEntityId: z.string().nullable(),
  contactPersonId: z.string().nullable(),
  serviceTicketId: z.string().nullable(),
  recordingUrl: z.string().nullable(),
  activeTranscriptVersionId: z.string().uuid().nullable(),
  activeSummaryVersionId: z.string().uuid().nullable(),
  startedAt: z.string().nullable(),
  answeredAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  lastSyncedAt: z.string().nullable(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdAt: z.string().nullable(),
  rawSnapshot: jsonRecordSchema.nullable(),
  activeTranscript: transcriptVersionSchema.nullable(),
  activeSummary: summaryVersionSchema.nullable(),
  transcriptVersions: z.array(transcriptVersionSchema),
  summaryVersions: z.array(summaryVersionSchema),
})

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function toListItem(call: PhoneCall): PhoneCallListItem {
  return {
    id: call.id,
    providerId: call.providerId,
    externalCallId: call.externalCallId,
    externalConversationId: call.externalConversationId ?? null,
    direction: call.direction,
    status: call.status,
    callerPhoneNumber: call.callerPhoneNumber ?? null,
    calleePhoneNumber: call.calleePhoneNumber ?? null,
    assignedUserId: call.assignedUserId ?? null,
    customerEntityId: call.customerEntityId ?? null,
    contactPersonId: call.contactPersonId ?? null,
    serviceTicketId: call.serviceTicketId ?? null,
    recordingUrl: call.recordingUrl ?? null,
    activeTranscriptVersionId: call.activeTranscriptVersionId ?? null,
    activeSummaryVersionId: call.activeSummaryVersionId ?? null,
    startedAt: toIso(call.startedAt),
    answeredAt: toIso(call.answeredAt),
    endedAt: toIso(call.endedAt),
    durationSeconds: call.durationSeconds ?? null,
    lastSyncedAt: toIso(call.lastSyncedAt),
    tenantId: call.tenantId,
    organizationId: call.organizationId,
    createdAt: toIso(call.createdAt),
  }
}

function toTranscriptView(version: PhoneCallTranscriptVersion): PhoneCallTranscriptVersionView {
  return {
    id: version.id,
    versionNo: version.versionNo,
    source: version.source,
    languageCode: version.languageCode ?? null,
    content: version.content,
    isActive: version.isActive,
    qualityScore: version.qualityScore ?? null,
    createdAt: toIso(version.createdAt),
  }
}

function toSummaryView(version: PhoneCallSummaryVersion): PhoneCallSummaryVersionView {
  return {
    id: version.id,
    transcriptVersionId: version.transcriptVersionId ?? null,
    versionNo: version.versionNo,
    generationType: version.generationType,
    summaryText: version.summaryText,
    serviceData: version.serviceData,
    manualOverrides: version.manualOverrides ?? null,
    fieldConfidence: version.fieldConfidence ?? null,
    requiresReview: version.requiresReview ?? null,
    promptVersion: version.promptVersion,
    modelName: version.modelName,
    isActive: version.isActive,
    qualityStatus: version.qualityStatus,
    createdAt: toIso(version.createdAt),
  }
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

    const transcriptVersions = await em.find(
      PhoneCallTranscriptVersion,
      {
        phoneCall: call,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<PhoneCallTranscriptVersion>,
      { orderBy: { versionNo: 'desc' }, limit: 20 },
    )
    const summaryVersions = await em.find(
      PhoneCallSummaryVersion,
      {
        phoneCall: call,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<PhoneCallSummaryVersion>,
      { orderBy: { versionNo: 'desc' }, limit: 20 },
    )

    const transcriptViews = transcriptVersions.map(toTranscriptView)
    const summaryViews = summaryVersions.map(toSummaryView)
    const activeTranscript = transcriptViews.find((version) => version.id === call.activeTranscriptVersionId)
      ?? transcriptViews.find((version) => version.isActive)
      ?? null
    const activeSummary = summaryViews.find((version) => version.id === call.activeSummaryVersionId)
      ?? summaryViews.find((version) => version.isActive)
      ?? null

    const result: PhoneCallDetail = {
      ...toListItem(call),
      rawSnapshot: call.rawSnapshot ?? null,
      activeTranscript,
      activeSummary,
      transcriptVersions: transcriptViews,
      summaryVersions: summaryViews,
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    const message = err instanceof Error && err.message ? err.message : 'Failed to load phone call'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Fetch phone call detail',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: {
    GET: {
      summary: 'Fetch phone call detail with transcript and summary versions',
      responses: [
        { status: 200, description: 'Phone call detail', schema: phoneCallDetailSchema },
        { status: 400, description: 'Invalid request', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 404, description: 'Not found', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
