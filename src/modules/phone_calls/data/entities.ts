import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  ManyToOne,
  OptionalProps,
} from '@mikro-orm/core'
import type { PhoneCallDirection, PhoneCallStatus } from '../lib/constants'

@Entity({ tableName: 'phone_calls' })
@Index({ name: 'pc_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'pc_started_at_idx', properties: ['startedAt'] })
@Index({ name: 'pc_caller_phone_idx', properties: ['callerPhoneNumber'] })
@Index({ name: 'pc_service_ticket_idx', properties: ['serviceTicketId'] })
@Unique({ name: 'pc_provider_external_unique', properties: ['providerId', 'externalCallId', 'tenantId', 'organizationId'] })
export class PhoneCall {
  [OptionalProps]?: 'direction' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'provider_id', type: 'text' })
  providerId!: string

  @Property({ name: 'external_call_id', type: 'text' })
  externalCallId!: string

  @Property({ name: 'external_conversation_id', type: 'text', nullable: true })
  externalConversationId?: string | null

  @Property({ type: 'text', default: 'unknown' })
  direction: PhoneCallDirection = 'unknown'

  @Property({ type: 'text', default: 'unknown' })
  status: PhoneCallStatus = 'unknown'

  @Property({ name: 'caller_phone_number', type: 'text', nullable: true })
  callerPhoneNumber?: string | null

  @Property({ name: 'callee_phone_number', type: 'text', nullable: true })
  calleePhoneNumber?: string | null

  @Property({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'contact_person_id', type: 'uuid', nullable: true })
  contactPersonId?: string | null

  @Property({ name: 'service_ticket_id', type: 'uuid', nullable: true })
  serviceTicketId?: string | null

  @Property({ name: 'recording_url', type: 'text', nullable: true })
  recordingUrl?: string | null

  @Property({ name: 'recording_attachment_id', type: 'uuid', nullable: true })
  recordingAttachmentId?: string | null

  @Property({ name: 'active_transcript_version_id', type: 'uuid', nullable: true })
  activeTranscriptVersionId?: string | null

  @Property({ name: 'active_summary_version_id', type: 'uuid', nullable: true })
  activeSummaryVersionId?: string | null

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'answered_at', type: Date, nullable: true })
  answeredAt?: Date | null

  @Property({ name: 'ended_at', type: Date, nullable: true })
  endedAt?: Date | null

  @Property({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds?: number | null

  @Property({ name: 'raw_snapshot', type: 'jsonb', nullable: true })
  rawSnapshot?: Record<string, unknown> | null

  @Property({ name: 'last_synced_at', type: Date, nullable: true })
  lastSyncedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'phone_call_transcript_versions' })
@Index({ name: 'pctv_phone_call_idx', properties: ['phoneCall'] })
@Unique({ name: 'pctv_call_version_unique', properties: ['phoneCall', 'versionNo'] })
export class PhoneCallTranscriptVersion {
  [OptionalProps]?: 'source' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => PhoneCall, { fieldName: 'phone_call_id' })
  phoneCall!: PhoneCall

  @Property({ name: 'version_no', type: 'integer' })
  versionNo!: number

  @Property({ type: 'text', default: 'tillio_pull' })
  source: string = 'tillio_pull'

  @Property({ name: 'language_code', type: 'text', nullable: true })
  languageCode?: string | null

  @Property({ type: 'text' })
  content!: string

  @Property({ name: 'speaker_segments', type: 'jsonb', nullable: true })
  speakerSegments?: Array<Record<string, unknown>> | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'quality_score', type: 'decimal', precision: 10, scale: 4, nullable: true })
  qualityScore?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'phone_call_summary_versions' })
@Index({ name: 'pcsv_phone_call_idx', properties: ['phoneCall'] })
@Unique({ name: 'pcsv_call_version_unique', properties: ['phoneCall', 'versionNo'] })
export class PhoneCallSummaryVersion {
  [OptionalProps]?: 'generationType' | 'promptVersion' | 'modelName' | 'isActive' | 'qualityStatus' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => PhoneCall, { fieldName: 'phone_call_id' })
  phoneCall!: PhoneCall

  @Property({ name: 'transcript_version_id', type: 'uuid', nullable: true })
  transcriptVersionId?: string | null

  @Property({ name: 'version_no', type: 'integer' })
  versionNo!: number

  @Property({ name: 'generation_type', type: 'text', default: 'provider' })
  generationType: string = 'provider'

  @Property({ name: 'summary_text', type: 'text' })
  summaryText!: string

  @Property({ name: 'service_data', type: 'jsonb' })
  serviceData!: Record<string, unknown>

  @Property({ name: 'manual_overrides', type: 'jsonb', nullable: true })
  manualOverrides?: Record<string, unknown> | null

  @Property({ name: 'field_confidence', type: 'jsonb', nullable: true })
  fieldConfidence?: Record<string, unknown> | null

  @Property({ name: 'requires_review', type: 'jsonb', nullable: true })
  requiresReview?: Record<string, unknown> | null

  @Property({ name: 'prompt_version', type: 'text', default: 'tillio' })
  promptVersion: string = 'tillio'

  @Property({ name: 'model_name', type: 'text', default: 'tillio' })
  modelName: string = 'tillio'

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'quality_status', type: 'text', default: 'requires_review' })
  qualityStatus: string = 'requires_review'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'phone_call_ingest_events' })
@Index({ name: 'pcie_call_idx', properties: ['externalCallId'] })
@Unique({ name: 'pcie_provider_event_unique', properties: ['providerId', 'externalEventId', 'tenantId', 'organizationId'] })
export class PhoneCallIngestEvent {
  [OptionalProps]?: 'status' | 'receivedAt' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'provider_id', type: 'text' })
  providerId!: string

  @Property({ name: 'external_event_id', type: 'text' })
  externalEventId!: string

  @Property({ name: 'external_call_id', type: 'text', nullable: true })
  externalCallId?: string | null

  @Property({ name: 'event_type', type: 'text' })
  eventType!: string

  @Property({ name: 'received_at', type: Date, onCreate: () => new Date() })
  receivedAt: Date = new Date()

  @Property({ name: 'processed_at', type: Date, nullable: true })
  processedAt?: Date | null

  @Property({ type: 'text', default: 'received' })
  status: string = 'received'

  @Property({ type: 'jsonb' })
  payload!: Record<string, unknown>

  @Property({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
