import { Migration } from '@mikro-orm/migrations';

export class Migration20260412100000_technicians_extend extends Migration {

  override async up(): Promise<void> {
    // Add new columns to technicians table
    this.addSql(`alter table "technicians" add column if not exists "display_name" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "first_name" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "last_name" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "email" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "phone" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "location_status" text not null default 'in_office';`);
    this.addSql(`alter table "technicians" add column if not exists "languages" jsonb not null default '[]';`);
    this.addSql(`alter table "technicians" add column if not exists "vehicle_id" uuid null;`);
    this.addSql(`alter table "technicians" add column if not exists "vehicle_label" text null;`);
    this.addSql(`alter table "technicians" add column if not exists "current_order_id" uuid null;`);

    // Add new columns to technician_certifications table
    this.addSql(`alter table "technician_certifications" add column if not exists "cert_type" text null;`);
    this.addSql(`alter table "technician_certifications" add column if not exists "code" text null;`);
    this.addSql(`alter table "technician_certifications" add column if not exists "issued_by" text null;`);
    this.addSql(`alter table "technician_certifications" add column if not exists "notes" text null;`);

    // Create technician_availability table
    this.addSql(`create table if not exists "technician_availability" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "technician_id" uuid not null, "date" date not null, "day_type" text not null default 'work_day', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "technician_availability_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "tech_avail_technician_idx" on "technician_availability" ("technician_id");`);
    this.addSql(`create index if not exists "tech_avail_tenant_org_idx" on "technician_availability" ("tenant_id", "organization_id");`);
    this.addSql(`create index if not exists "tech_avail_date_idx" on "technician_availability" ("tenant_id", "organization_id", "technician_id", "date");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "technician_availability";`);

    this.addSql(`alter table "technician_certifications" drop column if exists "cert_type";`);
    this.addSql(`alter table "technician_certifications" drop column if exists "code";`);
    this.addSql(`alter table "technician_certifications" drop column if exists "issued_by";`);
    this.addSql(`alter table "technician_certifications" drop column if exists "notes";`);

    this.addSql(`alter table "technicians" drop column if exists "display_name";`);
    this.addSql(`alter table "technicians" drop column if exists "first_name";`);
    this.addSql(`alter table "technicians" drop column if exists "last_name";`);
    this.addSql(`alter table "technicians" drop column if exists "email";`);
    this.addSql(`alter table "technicians" drop column if exists "phone";`);
    this.addSql(`alter table "technicians" drop column if exists "location_status";`);
    this.addSql(`alter table "technicians" drop column if exists "languages";`);
    this.addSql(`alter table "technicians" drop column if exists "vehicle_id";`);
    this.addSql(`alter table "technicians" drop column if exists "vehicle_label";`);
    this.addSql(`alter table "technicians" drop column if exists "current_order_id";`);
  }

}
