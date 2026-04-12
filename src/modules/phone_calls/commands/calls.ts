import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import crypto from 'node:crypto'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CredentialsService } from '@open-mercato/core/modules/integrations/lib/credentials-service'
import { PhoneCall, PhoneCallIngestEvent, PhoneCallSummaryVersion, PhoneCallTranscriptVersion } from '../data/entities'
import { generateTranscriptSchema, linkServiceTicketSchema, regenerateSummarySchema, retentionPruneSchema, tillioSyncSchema, tillioWebhookSchema } from '../data/validators'
import { emitPhoneCallEvent } from '../events'
import { TILLIO_INTEGRATION_ID, TILLIO_PROVIDER_ID } from '../lib/constants'
import { fetchTillioCalls, fetchTillioSummary, fetchTillioTranscript, normalizeTillioCall, type TillioCredentials } from '../lib/tillioClient'
import type { TillioSyncResult } from '../types'

export function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

function credentialsFromRaw(raw: Record<string, unknown> | null): TillioCredentials | null {
  if (!raw) return null
  const read = (key: string) => (typeof raw[key] === 'string' ? String(raw[key]) : '')
  const apiBaseUrl = read('apiBaseUrl')
  const plugin = read('plugin')
  const system = read('system')
  const tenant = read('tenant')
  const tenantDomain = read('tenantDomain')
  const apiKey = read('apiKey') || read('providerKey')
  const providerKey = read('providerKey')
  const token = read('token')

  if (!apiBaseUrl || !plugin || !system || !tenant || !tenantDomain || !apiKey || !providerKey) return null

  return {
    apiBaseUrl,
    plugin,
    system,
    tenant,
    tenantDomain,
    apiKey,
    providerKey,
    token: token || null,
  }
}

async function resolveTillioCredentials(ctx: CommandRuntimeContext, scope: { tenantId: string; organizationId: string }) {
  const credentialsService = ctx.container.resolve('integrationCredentialsService') as CredentialsService
  const credentials = credentialsFromRaw(await credentialsService.resolve(TILLIO_INTEGRATION_ID, scope))
  if (!credentials) throw new CrudHttpError(400, { error: 'Tillio credentials are not configured' })
  return credentials
}

async function findScopedCall(em: EntityManager, id: string, scope: { tenantId: string; organizationId: string }) {
  const call = await em.findOne(PhoneCall, {
    id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  } as FilterQuery<PhoneCall>)
  if (!call) throw new CrudHttpError(404, { error: 'Phone call not found' })
  return call
}

async function nextTranscriptVersionNo(em: EntityManager, phoneCallId: string): Promise<number> {
  const knex = (em as any).getConnection().getKnex()
  const row = await knex('phone_call_transcript_versions')
    .max('version_no as max_version')
    .where({ phone_call_id: phoneCallId })
    .first()
  return Number(row?.max_version ?? 0) + 1
}

async function nextSummaryVersionNo(em: EntityManager, phoneCallId: string): Promise<number> {
  const knex = (em as any).getConnection().getKnex()
  const row = await knex('phone_call_summary_versions')
    .max('version_no as max_version')
    .where({ phone_call_id: phoneCallId })
    .first()
  return Number(row?.max_version ?? 0) + 1
}

export const syncTillioCallsCommand: CommandHandler<Record<string, unknown>, TillioSyncResult> = {
  id: 'phone_calls.calls.sync_tillio',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const input = tillioSyncSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const credentials = await resolveTillioCredentials(ctx, scope)

    const em = ctx.container.resolve('em') as EntityManager
    const calls = await fetchTillioCalls(credentials, input)
    let created = 0
    let updated = 0
    let summarized = 0
    let summaryFailed = 0
    const now = new Date()
    const callsForSummary: PhoneCall[] = []

    for (const call of calls) {
      const existing = await em.findOne(PhoneCall, {
        providerId: TILLIO_PROVIDER_ID,
        externalCallId: call.externalCallId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<PhoneCall>)

      if (existing) {
        existing.externalConversationId = call.externalConversationId
        existing.direction = call.direction
        existing.status = call.status
        existing.callerPhoneNumber = call.callerPhoneNumber
        existing.calleePhoneNumber = call.calleePhoneNumber
        existing.recordingUrl = call.recordingUrl
        existing.startedAt = call.startedAt
        existing.answeredAt = call.answeredAt
        existing.endedAt = call.endedAt
        existing.durationSeconds = call.durationSeconds
        existing.rawSnapshot = call.rawSnapshot
        existing.lastSyncedAt = now
        if (existing.recordingUrl && !existing.activeSummaryVersionId) callsForSummary.push(existing)
        updated++
        continue
      }

      const createdCall = em.create(PhoneCall, {
        providerId: TILLIO_PROVIDER_ID,
        externalCallId: call.externalCallId,
        externalConversationId: call.externalConversationId,
        direction: call.direction,
        status: call.status,
        callerPhoneNumber: call.callerPhoneNumber,
        calleePhoneNumber: call.calleePhoneNumber,
        recordingUrl: call.recordingUrl,
        startedAt: call.startedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        rawSnapshot: call.rawSnapshot,
        lastSyncedAt: now,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
      em.persist(createdCall)
      if (createdCall.recordingUrl) callsForSummary.push(createdCall)
      created++
    }

    await em.flush()
    for (const call of callsForSummary) {
      if (!call.recordingUrl || call.activeSummaryVersionId) continue
      try {
        const summary = await fetchTillioSummary(credentials, call.externalCallId, { recordingUrl: call.recordingUrl })
        await em.nativeUpdate(PhoneCallSummaryVersion, { phoneCall: call, isActive: true } as FilterQuery<PhoneCallSummaryVersion>, { isActive: false })
        const version = em.create(PhoneCallSummaryVersion, {
          phoneCall: call,
          transcriptVersionId: call.activeTranscriptVersionId ?? null,
          versionNo: await nextSummaryVersionNo(em, call.id),
          generationType: 'provider',
          summaryText: summary.summaryText,
          serviceData: summary.serviceData,
          fieldConfidence: summary.fieldConfidence,
          requiresReview: summary.requiresReview,
          promptVersion: summary.promptVersion,
          modelName: summary.modelName,
          qualityStatus: summary.qualityStatus,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        })
        em.persist(version)
        await em.flush()
        call.activeSummaryVersionId = version.id
        await em.flush()
        summarized++
        await emitPhoneCallEvent('phone_calls.summary.generated', {
          id: call.id,
          summaryVersionId: version.id,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        })
      } catch {
        summaryFailed++
      }
    }
    await emitPhoneCallEvent('phone_calls.call.synced', {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      created,
      updated,
      total: calls.length,
      summarized,
      summaryFailed,
    })

    return { created, updated, total: calls.length, summarized, summaryFailed }
  },
}

export const linkServiceTicketCommand: CommandHandler<Record<string, unknown>, { id: string }> = {
  id: 'phone_calls.calls.link_service_ticket',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const input = linkServiceTicketSchema.extend({ id: z.string().uuid() }).parse(rawInput)
    const callId = input.id

    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const call = await findScopedCall(em, callId, scope)
    const previousServiceTicketId = call.serviceTicketId ?? null

    if (input.service_ticket_id) {
      const knex = (em as any).getConnection().getKnex()
      const row = await knex('service_tickets')
        .select('id')
        .where({
          id: input.service_ticket_id,
          tenant_id: scope.tenantId,
          organization_id: scope.organizationId,
        })
        .whereNull('deleted_at')
        .first()
      if (!row) throw new CrudHttpError(404, { error: 'Service ticket not found' })
    }

    call.serviceTicketId = input.service_ticket_id
    await em.flush()
    const eventPayload = {
      id: call.id,
      serviceTicketId: input.service_ticket_id,
      previousServiceTicketId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      sourceAction: input.source_action ?? null,
    }
    await emitPhoneCallEvent(input.service_ticket_id ? 'phone_calls.service_ticket.linked' : 'phone_calls.service_ticket.unlinked', eventPayload)
    if (input.service_ticket_id && input.source_action === 'create_from_call') {
      await emitPhoneCallEvent('phone_calls.service_ticket.created', eventPayload)
    }

    return { id: call.id }
  },
}

export const generateTranscriptCommand: CommandHandler<Record<string, unknown>, { id: string }> = {
  id: 'phone_calls.transcript.generate',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const input = generateTranscriptSchema.extend({ id: z.string().uuid() }).parse(rawInput)
    const scope = ensureScope(ctx)
    const credentials = await resolveTillioCredentials(ctx, scope)
    const em = ctx.container.resolve('em') as EntityManager
    const call = await findScopedCall(em, input.id, scope)
    const recordingUrl = input.recording_url || call.recordingUrl
    if (!recordingUrl) throw new CrudHttpError(400, { error: 'Recording URL is required to request transcription' })

    const transcript = await fetchTillioTranscript(credentials, call.externalCallId, {
      recordingUrl,
      languageCode: input.language_code ?? null,
    })

    await em.nativeUpdate(PhoneCallTranscriptVersion, { phoneCall: call, isActive: true } as FilterQuery<PhoneCallTranscriptVersion>, { isActive: false })
    const version = em.create(PhoneCallTranscriptVersion, {
      phoneCall: call,
      versionNo: await nextTranscriptVersionNo(em, call.id),
      source: 'tillio_pull',
      languageCode: transcript.languageCode ?? input.language_code ?? null,
      content: transcript.content,
      speakerSegments: transcript.speakerSegments,
      qualityScore: transcript.qualityScore,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    em.persist(version)
    await em.flush()

    call.activeTranscriptVersionId = version.id
    await em.flush()
    await emitPhoneCallEvent('phone_calls.transcript.stored', {
      id: call.id,
      transcriptVersionId: version.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return { id: version.id }
  },
}

export const regenerateSummaryCommand: CommandHandler<Record<string, unknown>, { id: string }> = {
  id: 'phone_calls.summary.regenerate',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const input = regenerateSummarySchema.extend({ id: z.string().uuid() }).parse(rawInput)
    const scope = ensureScope(ctx)
    const credentials = await resolveTillioCredentials(ctx, scope)
    const em = ctx.container.resolve('em') as EntityManager
    const call = await findScopedCall(em, input.id, scope)
    const recordingUrl = input.recording_url || call.recordingUrl
    if (!recordingUrl) throw new CrudHttpError(400, { error: 'Recording URL is required to request summary' })

    const summary = await fetchTillioSummary(credentials, call.externalCallId, { recordingUrl })
    await em.nativeUpdate(PhoneCallSummaryVersion, { phoneCall: call, isActive: true } as FilterQuery<PhoneCallSummaryVersion>, { isActive: false })
    const version = em.create(PhoneCallSummaryVersion, {
      phoneCall: call,
      transcriptVersionId: input.transcript_version_id || call.activeTranscriptVersionId || null,
      versionNo: await nextSummaryVersionNo(em, call.id),
      generationType: 'manual_regeneration',
      summaryText: summary.summaryText,
      serviceData: summary.serviceData,
      fieldConfidence: summary.fieldConfidence,
      requiresReview: summary.requiresReview,
      promptVersion: summary.promptVersion,
      modelName: summary.modelName,
      qualityStatus: summary.qualityStatus,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    em.persist(version)
    await em.flush()

    call.activeSummaryVersionId = version.id
    await em.flush()
    await emitPhoneCallEvent('phone_calls.summary.regenerated', {
      id: call.id,
      summaryVersionId: version.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return { id: version.id }
  },
}

function readWebhookString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function buildExternalEventId(providerId: string, eventType: string, payload: Record<string, unknown>): string {
  const explicit = readWebhookString(payload, ['event_id', 'eventId', 'id', 'uniqueid', 'callSessionId'])
  if (explicit) return explicit
  return crypto.createHash('sha256').update(JSON.stringify({ providerId, eventType, payload })).digest('hex')
}

export const ingestTillioWebhookCommand: CommandHandler<Record<string, unknown>, { id: string; duplicate: boolean }> = {
  id: 'phone_calls.call.ingest',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const payload = tillioWebhookSchema.parse(rawInput) as Record<string, unknown>
    const scope = ensureScope(ctx)
    const providerId = readWebhookString(payload, ['provider', 'providerId']) ?? TILLIO_PROVIDER_ID
    const eventType = readWebhookString(payload, ['event_type', 'eventType', 'type', 'notificationType']) ?? 'unknown'
    const externalEventId = buildExternalEventId(providerId, eventType, payload)
    const externalCallId = readWebhookString(payload, ['uniqueid', 'call_id', 'callId', 'callSessionId', 'id'])
    const em = ctx.container.resolve('em') as EntityManager

    const existingEvent = await em.findOne(PhoneCallIngestEvent, {
      providerId,
      externalEventId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<PhoneCallIngestEvent>)
    if (existingEvent) return { id: existingEvent.id, duplicate: true }

    const event = em.create(PhoneCallIngestEvent, {
      providerId,
      externalEventId,
      externalCallId,
      eventType,
      status: 'received',
      payload,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    em.persist(event)

    const normalized = normalizeTillioCall({
      id: externalCallId ?? externalEventId,
      call_id: externalCallId ?? externalEventId,
      call_type: readWebhookString(payload, ['call_type', 'direction']),
      direction: readWebhookString(payload, ['call_type', 'direction']),
      caller_number: readWebhookString(payload, ['caller_number', 'caller', 'from']),
      dst: readWebhookString(payload, ['dst', 'callee', 'to']),
      calldate: readWebhookString(payload, ['calldate', 'timestamp', 'startTime']),
      status: eventType,
      recording_url: readWebhookString(payload, ['recordingUrl', 'recordingWebUrl', 'recordingApiUrl']),
      ...payload,
    })

    if (normalized && externalCallId) {
      const existingCall = await em.findOne(PhoneCall, {
        providerId,
        externalCallId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<PhoneCall>)

      if (existingCall) {
        existingCall.externalConversationId = normalized.externalConversationId
        existingCall.direction = normalized.direction
        existingCall.status = normalized.status
        existingCall.callerPhoneNumber = normalized.callerPhoneNumber
        existingCall.calleePhoneNumber = normalized.calleePhoneNumber
        existingCall.recordingUrl = normalized.recordingUrl
        existingCall.startedAt = normalized.startedAt
        existingCall.answeredAt = normalized.answeredAt
        existingCall.endedAt = normalized.endedAt
        existingCall.durationSeconds = normalized.durationSeconds
        existingCall.rawSnapshot = normalized.rawSnapshot
      } else {
        em.persist(em.create(PhoneCall, {
          providerId,
          externalCallId,
          externalConversationId: normalized.externalConversationId,
          direction: normalized.direction,
          status: normalized.status,
          callerPhoneNumber: normalized.callerPhoneNumber,
          calleePhoneNumber: normalized.calleePhoneNumber,
          recordingUrl: normalized.recordingUrl,
          startedAt: normalized.startedAt,
          answeredAt: normalized.answeredAt,
          endedAt: normalized.endedAt,
          durationSeconds: normalized.durationSeconds,
          rawSnapshot: normalized.rawSnapshot,
          lastSyncedAt: new Date(),
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        }))
      }
    }

    event.status = 'processed'
    event.processedAt = new Date()
    await em.flush()
    await emitPhoneCallEvent('phone_calls.call.received', {
      id: externalCallId ?? undefined,
      ingestEventId: event.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return { id: event.id, duplicate: false }
  },
}

type RetentionPruneResult = {
  dryRun: boolean
  transcriptVersions: number
  summaryVersions: number
  ingestEvents: number
}

export const retentionPruneCommand: CommandHandler<Record<string, unknown>, RetentionPruneResult> = {
  id: 'phone_calls.retention.prune',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const input = retentionPruneSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()
    const now = Date.now()
    const transcriptBefore = new Date(now - input.transcript_retention_days * 24 * 60 * 60 * 1000)
    const summaryBefore = new Date(now - input.summary_retention_days * 24 * 60 * 60 * 1000)
    const ingestBefore = new Date(now - input.ingest_event_retention_days * 24 * 60 * 60 * 1000)

    const countFirst = async (query: unknown) => {
      const row = await (query as { first: () => Promise<Record<string, unknown> | undefined> }).first()
      return Number(row?.count ?? 0)
    }

    const transcriptQuery = () => knex('phone_call_transcript_versions')
      .count('id as count')
      .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, is_active: false })
      .whereNull('deleted_at')
      .where('created_at', '<', transcriptBefore)
    const summaryQuery = () => knex('phone_call_summary_versions')
      .count('id as count')
      .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, is_active: false })
      .whereNull('deleted_at')
      .where('created_at', '<', summaryBefore)
    const ingestQuery = () => knex('phone_call_ingest_events')
      .count('id as count')
      .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId })
      .where('received_at', '<', ingestBefore)

    const transcriptVersions = await countFirst(transcriptQuery())
    const summaryVersions = await countFirst(summaryQuery())
    const ingestEvents = await countFirst(ingestQuery())

    if (!input.dry_run) {
      await knex('phone_call_transcript_versions')
        .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, is_active: false })
        .whereNull('deleted_at')
        .where('created_at', '<', transcriptBefore)
        .update({ deleted_at: new Date(), updated_at: new Date() })
      await knex('phone_call_summary_versions')
        .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId, is_active: false })
        .whereNull('deleted_at')
        .where('created_at', '<', summaryBefore)
        .update({ deleted_at: new Date(), updated_at: new Date() })
      await knex('phone_call_ingest_events')
        .where({ tenant_id: scope.tenantId, organization_id: scope.organizationId })
        .where('received_at', '<', ingestBefore)
        .delete()
      await emitPhoneCallEvent('phone_calls.retention.pruned', {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        transcriptVersions,
        summaryVersions,
        ingestEvents,
      })
    }

    return { dryRun: input.dry_run, transcriptVersions, summaryVersions, ingestEvents }
  },
}

registerCommand(syncTillioCallsCommand)
registerCommand(linkServiceTicketCommand)
registerCommand(generateTranscriptCommand)
registerCommand(regenerateSummaryCommand)
registerCommand(ingestTillioWebhookCommand)
registerCommand(retentionPruneCommand)
