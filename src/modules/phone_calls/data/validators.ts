import { z } from 'zod'

export const phoneCallDirectionSchema = z.enum(['inbound', 'outbound', 'internal', 'unknown'])
export const phoneCallStatusSchema = z.enum(['new', 'synced', 'answered', 'missed', 'failed', 'unknown'])
export const transcriptSourceSchema = z.enum(['provider', 'ai_regeneration', 'manual_import', 'tillio_pull'])
export const summaryGenerationTypeSchema = z.enum(['provider', 'automatic', 'manual_regeneration'])
export const summaryQualityStatusSchema = z.enum(['draft', 'ready', 'requires_review', 'rejected'])

const emptyToUndefined = z.literal('').transform(() => undefined)
const optionalStr = z.union([emptyToUndefined, z.string().trim().min(1)]).optional()

export const phoneCallListQuerySchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    direction: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    service_ticket_id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('startedAt'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

export type PhoneCallListQuery = z.infer<typeof phoneCallListQuerySchema>

export const tillioSettingsSchema = z.object({
  api_base_url: z.string().url().default('https://api.tillio.io'),
  plugin: z.string().trim().min(1).default('Ringostat'),
  system: z.string().trim().min(1),
  tenant: z.string().trim().min(1),
  tenant_domain: z.string().trim().min(1),
  api_key: optionalStr,
  provider_key: optionalStr,
  token: optionalStr,
})

export type TillioSettingsInput = z.infer<typeof tillioSettingsSchema>

export const tillioSyncSchema = z.object({
  from: optionalStr,
  to: optionalStr,
  page: z.coerce.number().min(1).optional(),
})

export type TillioSyncInput = z.infer<typeof tillioSyncSchema>

export const linkServiceTicketSchema = z.object({
  service_ticket_id: z.string().uuid().nullable(),
  source_action: z.enum(['link_existing', 'create_from_call', 'unlink']).optional(),
})

export type LinkServiceTicketInput = z.infer<typeof linkServiceTicketSchema>

export const generateTranscriptSchema = z.object({
  recording_url: optionalStr,
  language_code: optionalStr,
})

export type GenerateTranscriptInput = z.infer<typeof generateTranscriptSchema>

export const regenerateSummarySchema = z.object({
  recording_url: optionalStr,
  transcript_version_id: optionalStr,
})

export type RegenerateSummaryInput = z.infer<typeof regenerateSummarySchema>

export const tillioWebhookSchema = z.object({}).passthrough()

export type TillioWebhookInput = z.infer<typeof tillioWebhookSchema>

export const retentionPruneSchema = z.object({
  transcript_retention_days: z.coerce.number().int().min(1).max(3650).default(365),
  summary_retention_days: z.coerce.number().int().min(1).max(3650).default(730),
  ingest_event_retention_days: z.coerce.number().int().min(1).max(3650).default(90),
  dry_run: z.boolean().default(true),
})

export type RetentionPruneInput = z.infer<typeof retentionPruneSchema>
