import { Migration } from '@mikro-orm/migrations'

export class Migration20260412213000_drop_legacy_technician_availability extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop table if exists "technician_availability";`)
  }

  override async down(): Promise<void> {
    this.addSql(`create table if not exists "technician_availability" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "technician_id" uuid not null, "date" date not null, "day_type" text not null default 'work_day', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "technician_availability_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "tech_avail_technician_idx" on "technician_availability" ("technician_id");`)
    this.addSql(`create index if not exists "tech_avail_tenant_org_idx" on "technician_availability" ("tenant_id", "organization_id");`)
    this.addSql(`create index if not exists "tech_avail_date_idx" on "technician_availability" ("tenant_id", "organization_id", "technician_id", "date");`)
  }

}
