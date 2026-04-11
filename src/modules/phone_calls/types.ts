import type { PhoneCallDirection, PhoneCallStatus } from './lib/constants'

export type PhoneCallListItem = {
  id: string
  providerId: string
  externalCallId: string
  externalConversationId: string | null
  direction: PhoneCallDirection
  status: PhoneCallStatus
  callerPhoneNumber: string | null
  calleePhoneNumber: string | null
  assignedUserId: string | null
  customerEntityId: string | null
  contactPersonId: string | null
  serviceTicketId: string | null
  recordingUrl: string | null
  activeTranscriptVersionId: string | null
  activeSummaryVersionId: string | null
  startedAt: string | null
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number | null
  lastSyncedAt: string | null
  tenantId: string
  organizationId: string
  createdAt: string | null
}

export type PhoneCallTranscriptVersionView = {
  id: string
  versionNo: number
  source: string
  languageCode: string | null
  content: string
  isActive: boolean
  qualityScore: string | null
  createdAt: string | null
}

export type PhoneCallSummaryVersionView = {
  id: string
  transcriptVersionId: string | null
  versionNo: number
  generationType: string
  summaryText: string
  serviceData: Record<string, unknown>
  manualOverrides: Record<string, unknown> | null
  fieldConfidence: Record<string, unknown> | null
  requiresReview: Record<string, unknown> | null
  promptVersion: string
  modelName: string
  isActive: boolean
  qualityStatus: string
  createdAt: string | null
}

export type PhoneCallDetail = PhoneCallListItem & {
  rawSnapshot: Record<string, unknown> | null
  activeTranscript: PhoneCallTranscriptVersionView | null
  activeSummary: PhoneCallSummaryVersionView | null
  transcriptVersions: PhoneCallTranscriptVersionView[]
  summaryVersions: PhoneCallSummaryVersionView[]
}

export type TillioSettingsView = {
  configured: boolean
  apiBaseUrl: string
  plugin: string
  system: string
  tenant: string
  tenantDomain: string
  hasApiKey: boolean
  hasProviderKey: boolean
  hasToken: boolean
}

export type TillioSyncResult = {
  created: number
  updated: number
  total: number
  summarized?: number
  summaryFailed?: number
}

export type PhoneCallHealth = {
  configured: boolean
  callsTotal: number
  callsWithoutServiceTicket: number
  callsWithoutSummary: number
  callsRecordingPending: number
  failedIngestEvents24h: number
  oldestPendingIngestEventAt: string | null
  lastSyncedAt: string | null
}

export type PhoneCallRetentionPruneResult = {
  dryRun: boolean
  transcriptVersions: number
  summaryVersions: number
  ingestEvents: number
}
