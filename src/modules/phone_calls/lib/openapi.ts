import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export const phoneCallsTag = 'Phone Calls'

export const okSchema = z.object({ ok: z.literal(true) })

export const tillioSettingsViewSchema = z.object({
  configured: z.boolean(),
  apiBaseUrl: z.string(),
  plugin: z.string(),
  system: z.string(),
  tenant: z.string(),
  tenantDomain: z.string(),
  hasApiKey: z.boolean(),
  hasProviderKey: z.boolean(),
  hasToken: z.boolean(),
})

export const tillioSyncResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  total: z.number(),
  summarized: z.number().optional(),
  summaryFailed: z.number().optional(),
})

export const phoneCallListItemSchema = z.object({
  id: z.string(),
  provider_id: z.string(),
  external_call_id: z.string(),
  external_conversation_id: z.string().nullable().optional(),
  direction: z.string(),
  status: z.string(),
  caller_phone_number: z.string().nullable().optional(),
  callee_phone_number: z.string().nullable().optional(),
  assigned_user_id: z.string().nullable().optional(),
  customer_entity_id: z.string().nullable().optional(),
  contact_person_id: z.string().nullable().optional(),
  service_ticket_id: z.string().nullable().optional(),
  recording_url: z.string().nullable().optional(),
  active_transcript_version_id: z.string().nullable().optional(),
  active_summary_version_id: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  answered_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  last_synced_at: z.string().nullable().optional(),
  tenant_id: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
}).passthrough()

export function createPhoneCallPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildPhoneCallCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: phoneCallsTag,
  defaultOkResponseSchema: okSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createPhoneCallCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildPhoneCallCrudOpenApi(options)
}
