import { TILLIO_DEFAULT_API_BASE_URL } from './constants'

export type TillioCredentials = {
  apiBaseUrl: string
  plugin: string
  system: string
  tenant: string
  tenantDomain: string
  apiKey: string
  providerKey: string
  token?: string | null
}

export type NormalizedTillioCall = {
  externalCallId: string
  externalConversationId: string | null
  direction: 'inbound' | 'outbound' | 'internal' | 'unknown'
  status: 'new' | 'synced' | 'answered' | 'missed' | 'failed' | 'unknown'
  callerPhoneNumber: string | null
  calleePhoneNumber: string | null
  recordingUrl: string | null
  startedAt: Date | null
  answeredAt: Date | null
  endedAt: Date | null
  durationSeconds: number | null
  rawSnapshot: Record<string, unknown>
}

export type TillioTranscriptArtifact = {
  content: string
  languageCode: string | null
  speakerSegments: Array<Record<string, unknown>> | null
  qualityScore: string | null
  raw: Record<string, unknown>
}

export type TillioSummaryArtifact = {
  summaryText: string
  serviceData: Record<string, unknown>
  fieldConfidence: Record<string, unknown> | null
  requiresReview: Record<string, unknown> | null
  promptVersion: string
  modelName: string
  qualityStatus: 'draft' | 'ready' | 'requires_review' | 'rejected'
  raw: Record<string, unknown>
}

type TillioCallsResponse = {
  calls: unknown[]
  pagination?: Record<string, unknown>
}

function baseUrl(value: string | null | undefined): string {
  const normalized = value?.trim() || TILLIO_DEFAULT_API_BASE_URL
  return normalized.replace(/\/+$/, '')
}

function buildHeaders(credentials: TillioCredentials, includeToken: boolean): HeadersInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': credentials.apiKey,
    'x-system': credentials.system,
    'x-tenant': credentials.tenant,
    'x-tenant-domain': credentials.tenantDomain,
  }

  if (includeToken && credentials.token) {
    headers['x-token'] = credentials.token
  }

  return headers
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function requestTillio<T>(
  credentials: TillioCredentials,
  path: string,
  init: RequestInit,
  includeToken: boolean,
): Promise<T> {
  const response = await fetch(`${baseUrl(credentials.apiBaseUrl)}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(credentials, includeToken),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const payload = await readJson(response)

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Tillio API returned ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function validateTillioConfig(credentials: TillioCredentials): Promise<boolean> {
  const payload = await requestTillio<{ valid?: boolean }>(
    credentials,
    '/api/config/validate',
    {
      method: 'POST',
      body: JSON.stringify({
        plugin: credentials.plugin,
        config: { key: credentials.providerKey },
      }),
    },
    false,
  )

  return payload?.valid === true
}

export async function createTillioConfig(credentials: TillioCredentials): Promise<string> {
  const payload = await requestTillio<{ token?: string }>(
    credentials,
    '/api/config',
    {
      method: 'POST',
      body: JSON.stringify({
        plugin: credentials.plugin,
        config: { key: credentials.providerKey },
      }),
    },
    false,
  )

  if (!payload?.token) throw new Error('Tillio did not return a token')
  return payload.token
}

export async function fetchTillioCalls(
  credentials: TillioCredentials,
  filters: { from?: string; to?: string; page?: number },
): Promise<NormalizedTillioCall[]> {
  if (!credentials.token) throw new Error('Tillio token is not configured')

  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page) params.set('page', String(filters.page))

  const suffix = params.toString() ? `?${params.toString()}` : ''
  const payload = await requestTillio<TillioCallsResponse>(credentials, `/api/call${suffix}`, { method: 'GET' }, true)
  const calls = Array.isArray(payload?.calls) ? payload.calls : []
  return calls.map(normalizeTillioCall).filter((call): call is NormalizedTillioCall => call !== null)
}

export async function fetchTillioTranscript(
  credentials: TillioCredentials,
  externalCallId: string,
  input: { recordingUrl: string; languageCode?: string | null },
): Promise<TillioTranscriptArtifact> {
  if (!credentials.token) throw new Error('Tillio token is not configured')
  const payload = await requestTillio<unknown>(
    credentials,
    `/api/call/${encodeURIComponent(externalCallId)}/trn`,
    {
      method: 'POST',
      body: JSON.stringify({
        recordingUrl: input.recordingUrl,
        languageCode: input.languageCode ?? undefined,
      }),
    },
    true,
  )
  return normalizeTillioTranscript(payload)
}

export async function fetchTillioSummary(
  credentials: TillioCredentials,
  externalCallId: string,
  input: { recordingUrl: string },
): Promise<TillioSummaryArtifact> {
  if (!credentials.token) throw new Error('Tillio token is not configured')
  const payload = await requestTillio<unknown>(
    credentials,
    `/api/call/${encodeURIComponent(externalCallId)}/sum`,
    {
      method: 'POST',
      body: JSON.stringify({ recordingUrl: input.recordingUrl }),
    },
    true,
  )
  return normalizeTillioSummary(payload)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function firstNestedString(source: Record<string, unknown>, nestedKeys: string[], keys: string[]): string | null {
  for (const nestedKey of nestedKeys) {
    const record = asRecord(source[nestedKey])
    if (!record) continue
    const value = firstString(record, keys)
    if (value) return value
  }
  return null
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return Math.trunc(parsed)
    }
  }
  return null
}

function firstDate(source: Record<string, unknown>, keys: string[]): Date | null {
  const value = firstString(source, keys)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeDirection(value: string | null): NormalizedTillioCall['direction'] {
  const normalized = value?.toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized.includes('in') || normalized === 'incoming') return 'inbound'
  if (normalized.includes('out') || normalized === 'outgoing') return 'outbound'
  if (normalized.includes('internal')) return 'internal'
  return 'unknown'
}

function normalizeStatus(value: string | null): NormalizedTillioCall['status'] {
  const normalized = value?.toLowerCase()
  if (!normalized) return 'synced'
  if (normalized.includes('miss')) return 'missed'
  if (normalized.includes('fail') || normalized.includes('cancel')) return 'failed'
  if (normalized.includes('answer') || normalized.includes('success') || normalized.includes('proper') || normalized.includes('complete')) return 'answered'
  return 'synced'
}

function nestedRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key]
    const record = asRecord(value)
    if (record) return record
  }
  return null
}

function firstArrayOfRecords(source: Record<string, unknown>, keys: string[]): Array<Record<string, unknown>> | null {
  for (const key of keys) {
    const value = source[key]
    if (!Array.isArray(value)) continue
    const records = value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
    if (records.length) return records
  }
  return null
}

function normalizeQualityStatus(value: string | null): TillioSummaryArtifact['qualityStatus'] {
  const normalized = value?.toLowerCase()
  if (normalized === 'ready' || normalized === 'draft' || normalized === 'rejected') return normalized
  return 'requires_review'
}

export function normalizeTillioCall(value: unknown): NormalizedTillioCall | null {
  const source = asRecord(value)
  if (!source) return null

  const externalCallId = firstString(source, ['id', 'call_id', 'callId', 'uuid', 'external_id', 'externalId'])
  if (!externalCallId) return null
  const recordingUrl =
    firstString(source, ['recording_url', 'recordingUrl', 'record_url', 'rec_url', 'recording', 'record', 'recordingApiUrl', 'recordingWebUrl'])
    ?? firstNestedString(source, ['extraFields', 'extra_fields', 'details'], ['recording', 'recording_url', 'recordingUrl', 'record_url', 'rec_url', 'recordingApiUrl', 'recordingWebUrl'])
  const calleePhoneNumber =
    firstString(source, ['callee', 'callee_number', 'calleeNumber', 'to', 'phone_to', 'dst', 'destination', 'calledNumber'])
    ?? firstNestedString(source, ['extraFields', 'extra_fields', 'details'], ['callee', 'callee_number', 'calleeNumber', 'to', 'phone_to', 'dst', 'destination', 'calledNumber'])
  const callerPhoneNumber =
    firstString(source, ['caller', 'caller_number', 'callerNumber', 'from', 'phone_from', 'src', 'callingNumber'])
    ?? firstNestedString(source, ['extraFields', 'extra_fields', 'details'], ['caller', 'caller_number', 'callerNumber', 'from', 'phone_from', 'src', 'callingNumber'])

  return {
    externalCallId,
    externalConversationId: firstString(source, ['conversation_id', 'conversationId', 'session_id', 'sessionId']),
    direction: normalizeDirection(firstString(source, ['direction', 'call_direction', 'type'])),
    status: normalizeStatus(firstString(source, ['status', 'disposition', 'call_status', 'result'])),
    callerPhoneNumber,
    calleePhoneNumber,
    recordingUrl,
    startedAt: firstDate(source, ['started_at', 'startedAt', 'start_time', 'startTime', 'created_at', 'date', 'calldate']),
    answeredAt: firstDate(source, ['answered_at', 'answeredAt', 'answer_time', 'answerTime']),
    endedAt: firstDate(source, ['ended_at', 'endedAt', 'end_time', 'endTime']),
    durationSeconds: firstNumber(source, ['duration_seconds', 'durationSeconds', 'duration', 'call_duration', 'billSec', 'bill_sec']),
    rawSnapshot: source,
  }
}

export function normalizeTillioTranscript(value: unknown): TillioTranscriptArtifact {
  const source = asRecord(value) ?? { value }
  const transcriptRecord = nestedRecord(source, ['transcription', 'transcript', 'data', 'result', 'response'])
  const content =
    firstString(source, ['content', 'text', 'result'])
    ?? (transcriptRecord ? firstString(transcriptRecord, ['content', 'text', 'transcript', 'transcription', 'result']) : null)
  if (!content) throw new Error('Tillio transcript response did not include transcript content')

  return {
    content,
    languageCode:
      firstString(source, ['language_code', 'languageCode', 'language'])
      ?? (transcriptRecord ? firstString(transcriptRecord, ['language_code', 'languageCode', 'language']) : null),
    speakerSegments:
      firstArrayOfRecords(source, ['speaker_segments', 'speakerSegments', 'segments'])
      ?? (transcriptRecord ? firstArrayOfRecords(transcriptRecord, ['speaker_segments', 'speakerSegments', 'segments']) : null),
    qualityScore:
      firstString(source, ['quality_score', 'qualityScore', 'score'])
      ?? (transcriptRecord ? firstString(transcriptRecord, ['quality_score', 'qualityScore', 'score', 'avg_logprob']) : null),
    raw: source,
  }
}

export function normalizeTillioSummary(value: unknown): TillioSummaryArtifact {
  const source = asRecord(value) ?? { value }
  const summaryRecord = nestedRecord(source, ['summary', 'data', 'result', 'response'])
  const summaryText =
    firstString(source, ['summary_text', 'summaryText', 'text', 'result'])
    ?? (summaryRecord
      ? firstString(summaryRecord, [
        'summary_text',
        'summaryText',
        'crm_note_summary_v4',
        'crm_note_summary_v3',
        'crm_note_summary_v2',
        'crm_note_summary_v1',
        'text',
        'result',
      ])
      : null)
  if (!summaryText) throw new Error('Tillio summary response did not include summary text')

  return {
    summaryText,
    serviceData: nestedRecord(source, ['service_data', 'serviceData', 'fields']) ?? summaryRecord ?? {},
    fieldConfidence:
      nestedRecord(source, ['field_confidence', 'fieldConfidence', 'confidence'])
      ?? (summaryRecord ? nestedRecord(summaryRecord, ['field_confidence', 'fieldConfidence', 'confidence']) : null),
    requiresReview:
      nestedRecord(source, ['requires_review', 'requiresReview', 'flags'])
      ?? (summaryRecord ? nestedRecord(summaryRecord, ['requires_review', 'requiresReview', 'flags']) : null),
    promptVersion: firstString(source, ['prompt_version', 'promptVersion']) ?? 'tillio',
    modelName: firstString(source, ['model_name', 'modelName', 'model']) ?? 'tillio',
    qualityStatus: normalizeQualityStatus(
      firstString(source, ['quality_status', 'qualityStatus', 'status'])
      ?? (summaryRecord ? firstString(summaryRecord, ['quality_status', 'qualityStatus', 'status', 'phone_call_success']) : null),
    ),
    raw: source,
  }
}
