import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { PhoneCall } from '../../data/entities'
import { phoneCallListQuerySchema, type PhoneCallListQuery } from '../../data/validators'
import { ENTITY_TYPE } from '../../lib/constants'
import type { PhoneCallListItem } from '../../types'
import {
  createPhoneCallCrudOpenApi,
  createPhoneCallPagedListResponseSchema,
  phoneCallListItemSchema,
} from '../../lib/openapi'

type BaseFields = Record<string, unknown>

export const { metadata, GET } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['integrations.view'] },
  },
  orm: {
    entity: PhoneCall,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: phoneCallListQuerySchema,
    entityId: ENTITY_TYPE,
    fields: [
      'id',
      'provider_id',
      'external_call_id',
      'external_conversation_id',
      'direction',
      'status',
      'caller_phone_number',
      'callee_phone_number',
      'assigned_user_id',
      'customer_entity_id',
      'contact_person_id',
      'service_ticket_id',
      'recording_url',
      'active_transcript_version_id',
      'active_summary_version_id',
      'started_at',
      'answered_at',
      'ended_at',
      'duration_seconds',
      'last_synced_at',
      'tenant_id',
      'organization_id',
      'created_at',
    ],
    sortFieldMap: {
      startedAt: 'started_at',
      endedAt: 'ended_at',
      createdAt: 'created_at',
      status: 'status',
      direction: 'direction',
    },
    buildFilters: async (q: PhoneCallListQuery): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>

      if (q.id) F.id = q.id
      if (q.ids) F.id = { $in: q.ids.split(',') }
      if (q.direction) F.direction = { $in: q.direction.split(',') }
      if (q.status) F.status = { $in: q.status.split(',') }
      if (q.service_ticket_id) F.service_ticket_id = q.service_ticket_id

      if (q.search) {
        const escaped = escapeLikePattern(q.search)
        F.$or = [
          { external_call_id: { $ilike: `%${escaped}%` } },
          { caller_phone_number: { $ilike: `%${escaped}%` } },
          { callee_phone_number: { $ilike: `%${escaped}%` } },
        ]
      }

      return filters
    },
    transformItem: (item: BaseFields): PhoneCallListItem => {
      const source = item as Record<string, unknown>
      const str = (camelCase: string, snakeCase: string) => String(source[camelCase] ?? source[snakeCase] ?? '')
      const nullable = (camelCase: string, snakeCase: string) =>
        (source[camelCase] ?? source[snakeCase] ?? null) as string | null
      const date = (camelCase: string, snakeCase: string) => {
        const value = source[camelCase] ?? source[snakeCase]
        return value ? new Date(value as string | number).toISOString() : null
      }
      const num = (camelCase: string, snakeCase: string) => {
        const value = source[camelCase] ?? source[snakeCase]
        return typeof value === 'number' ? value : value == null ? null : Number(value)
      }

      return {
        id: str('id', 'id'),
        providerId: str('providerId', 'provider_id'),
        externalCallId: str('externalCallId', 'external_call_id'),
        externalConversationId: nullable('externalConversationId', 'external_conversation_id'),
        direction: str('direction', 'direction') as PhoneCallListItem['direction'],
        status: str('status', 'status') as PhoneCallListItem['status'],
        callerPhoneNumber: nullable('callerPhoneNumber', 'caller_phone_number'),
        calleePhoneNumber: nullable('calleePhoneNumber', 'callee_phone_number'),
        assignedUserId: nullable('assignedUserId', 'assigned_user_id'),
        customerEntityId: nullable('customerEntityId', 'customer_entity_id'),
        contactPersonId: nullable('contactPersonId', 'contact_person_id'),
        serviceTicketId: nullable('serviceTicketId', 'service_ticket_id'),
        recordingUrl: nullable('recordingUrl', 'recording_url'),
        activeTranscriptVersionId: nullable('activeTranscriptVersionId', 'active_transcript_version_id'),
        activeSummaryVersionId: nullable('activeSummaryVersionId', 'active_summary_version_id'),
        startedAt: date('startedAt', 'started_at'),
        answeredAt: date('answeredAt', 'answered_at'),
        endedAt: date('endedAt', 'ended_at'),
        durationSeconds: num('durationSeconds', 'duration_seconds'),
        lastSyncedAt: date('lastSyncedAt', 'last_synced_at'),
        tenantId: str('tenantId', 'tenant_id'),
        organizationId: str('organizationId', 'organization_id'),
        createdAt: date('createdAt', 'created_at'),
      }
    },
  },
})

export const openApi: OpenApiRouteDoc = createPhoneCallCrudOpenApi({
  resourceName: 'Phone Call',
  pluralName: 'Phone Calls',
  querySchema: phoneCallListQuerySchema,
  listResponseSchema: createPhoneCallPagedListResponseSchema(phoneCallListItemSchema),
})
