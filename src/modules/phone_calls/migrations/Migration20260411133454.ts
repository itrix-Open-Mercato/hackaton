import { Migration } from '@mikro-orm/migrations';

export class Migration20260411133454 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "phone_calls" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "provider_id" text not null, "external_call_id" text not null, "external_conversation_id" text null, "direction" text not null default 'unknown', "status" text not null default 'unknown', "caller_phone_number" text null, "callee_phone_number" text null, "assigned_user_id" uuid null, "customer_entity_id" uuid null, "contact_person_id" uuid null, "service_ticket_id" uuid null, "recording_url" text null, "recording_attachment_id" uuid null, "active_transcript_version_id" uuid null, "active_summary_version_id" uuid null, "started_at" timestamptz null, "answered_at" timestamptz null, "ended_at" timestamptz null, "duration_seconds" int null, "raw_snapshot" jsonb null, "last_synced_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "phone_calls_pkey" primary key ("id"));`);
    this.addSql(`create index "pc_service_ticket_idx" on "phone_calls" ("service_ticket_id");`);
    this.addSql(`create index "pc_caller_phone_idx" on "phone_calls" ("caller_phone_number");`);
    this.addSql(`create index "pc_started_at_idx" on "phone_calls" ("started_at");`);
    this.addSql(`create index "pc_tenant_org_idx" on "phone_calls" ("tenant_id", "organization_id");`);
    this.addSql(`alter table "phone_calls" add constraint "pc_provider_external_unique" unique ("provider_id", "external_call_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "phone_call_ingest_events" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "provider_id" text not null, "external_event_id" text not null, "external_call_id" text null, "event_type" text not null, "received_at" timestamptz not null, "processed_at" timestamptz null, "status" text not null default 'received', "payload" jsonb not null, "error_message" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "phone_call_ingest_events_pkey" primary key ("id"));`);
    this.addSql(`create index "pcie_call_idx" on "phone_call_ingest_events" ("external_call_id");`);
    this.addSql(`alter table "phone_call_ingest_events" add constraint "pcie_provider_event_unique" unique ("provider_id", "external_event_id", "tenant_id", "organization_id");`);

    this.addSql(`create table "phone_call_summary_versions" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "phone_call_id" uuid not null, "transcript_version_id" uuid null, "version_no" int not null, "generation_type" text not null default 'provider', "summary_text" text not null, "service_data" jsonb not null, "manual_overrides" jsonb null, "field_confidence" jsonb null, "requires_review" jsonb null, "prompt_version" text not null default 'tillio', "model_name" text not null default 'tillio', "is_active" boolean not null default true, "quality_status" text not null default 'requires_review', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "phone_call_summary_versions_pkey" primary key ("id"));`);
    this.addSql(`create index "pcsv_phone_call_idx" on "phone_call_summary_versions" ("phone_call_id");`);
    this.addSql(`alter table "phone_call_summary_versions" add constraint "pcsv_call_version_unique" unique ("phone_call_id", "version_no");`);

    this.addSql(`create table "phone_call_transcript_versions" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "phone_call_id" uuid not null, "version_no" int not null, "source" text not null default 'tillio_pull', "language_code" text null, "content" text not null, "speaker_segments" jsonb null, "is_active" boolean not null default true, "quality_score" numeric(10,4) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "phone_call_transcript_versions_pkey" primary key ("id"));`);
    this.addSql(`create index "pctv_phone_call_idx" on "phone_call_transcript_versions" ("phone_call_id");`);
    this.addSql(`alter table "phone_call_transcript_versions" add constraint "pctv_call_version_unique" unique ("phone_call_id", "version_no");`);

    this.addSql(`alter table "phone_call_summary_versions" add constraint "phone_call_summary_versions_phone_call_id_foreign" foreign key ("phone_call_id") references "phone_calls" ("id") on update cascade;`);

    this.addSql(`alter table "phone_call_transcript_versions" add constraint "phone_call_transcript_versions_phone_call_id_foreign" foreign key ("phone_call_id") references "phone_calls" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "phone_call_summary_versions" drop constraint "phone_call_summary_versions_phone_call_id_foreign";`);

    this.addSql(`alter table "phone_call_transcript_versions" drop constraint "phone_call_transcript_versions_phone_call_id_foreign";`);

    this.addSql(`drop table if exists "phone_call_transcript_versions" cascade;`);

    this.addSql(`drop table if exists "phone_call_summary_versions" cascade;`);

    this.addSql(`drop table if exists "phone_call_ingest_events" cascade;`);

    this.addSql(`drop table if exists "phone_calls" cascade;`);
  }

}
