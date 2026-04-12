import { Migration } from '@mikro-orm/migrations'

export class Migration20260412100000_ticket_service_types extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "service_ticket_service_types" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "ticket_id" uuid not null,
      "machine_service_type_id" uuid not null,
      "created_at" timestamptz not null default now(),
      constraint "service_ticket_service_types_pkey" primary key ("id"),
      constraint "stst_ticket_service_type_unique" unique ("ticket_id", "machine_service_type_id")
    );`)

    this.addSql(`create index if not exists "stst_ticket_idx" on "service_ticket_service_types" ("ticket_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "service_ticket_service_types";`)
  }

}
