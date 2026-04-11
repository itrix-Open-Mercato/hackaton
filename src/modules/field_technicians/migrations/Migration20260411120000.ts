import { Migration } from '@mikro-orm/migrations';

export class Migration20260411120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "field_technician_availability" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "technician_id" uuid not null, "date" date not null, "day_type" text not null default 'work_day', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "field_technician_availability_pkey" primary key ("id"));`);
    this.addSql(`create index "field_technician_avail_technician_idx" on "field_technician_availability" ("technician_id");`);
    this.addSql(`create index "field_technician_avail_tenant_org_idx" on "field_technician_availability" ("tenant_id", "organization_id");`);
    this.addSql(`create index "field_technician_avail_date_idx" on "field_technician_availability" ("tenant_id", "organization_id", "technician_id", "date");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "field_technician_availability";`);
  }

}
