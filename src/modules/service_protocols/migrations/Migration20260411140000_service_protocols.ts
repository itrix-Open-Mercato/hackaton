import { Migration } from '@mikro-orm/migrations'

export class Migration20260411140000_service_protocols extends Migration {

  override async up(): Promise<void> {
    // service_protocols
    this.addSql(`
      create table if not exists "service_protocols" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "service_ticket_id" uuid not null,
        "protocol_number" text not null,
        "status" text not null default 'draft',
        "type" text not null default 'standard',
        "customer_entity_id" uuid null,
        "contact_person_id" uuid null,
        "machine_asset_id" uuid null,
        "service_address_snapshot" jsonb null,
        "ticket_description_snapshot" text null,
        "planned_visit_date_snapshot" timestamptz null,
        "planned_visit_end_date_snapshot" timestamptz null,
        "work_description" text null,
        "technician_notes" text null,
        "customer_notes" text null,
        "prepared_cost_summary" jsonb null,
        "is_active" boolean not null default true,
        "closed_at" timestamptz null,
        "closed_by_user_id" uuid null,
        "completed_ticket_on_close" boolean not null default false,
        "created_by_user_id" uuid null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "service_protocols_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "sp_tenant_org_idx" on "service_protocols" ("tenant_id", "organization_id");`)
    this.addSql(`create index if not exists "sp_ticket_tenant_org_idx" on "service_protocols" ("service_ticket_id", "tenant_id", "organization_id");`)
    this.addSql(`create index if not exists "sp_status_tenant_org_idx" on "service_protocols" ("status", "tenant_id", "organization_id");`)
    this.addSql(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'sp_protocol_number_unique') then
          alter table "service_protocols" add constraint "sp_protocol_number_unique" unique ("protocol_number", "tenant_id", "organization_id");
        end if;
      end $$;
    `)

    // service_protocol_technicians
    this.addSql(`
      create table if not exists "service_protocol_technicians" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "protocol_id" uuid not null,
        "staff_member_id" uuid not null,
        "date_from" date null,
        "date_to" date null,
        "hours_worked" decimal not null default 0,
        "hourly_rate_snapshot" decimal null,
        "is_billable" boolean not null default false,
        "km_driven" decimal not null default 0,
        "km_rate_snapshot" decimal null,
        "km_is_billable" boolean not null default false,
        "delegation_days" integer not null default 0,
        "delegation_country" text null,
        "diet_rate_snapshot" decimal null,
        "hotel_invoice_ref" text null,
        "hotel_amount" decimal null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "service_protocol_technicians_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'spt_protocol_staff_unique') then
          alter table "service_protocol_technicians" add constraint "spt_protocol_staff_unique" unique ("protocol_id", "staff_member_id");
        end if;
      end $$;
    `)

    // service_protocol_parts
    this.addSql(`
      create table if not exists "service_protocol_parts" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "protocol_id" uuid not null,
        "catalog_product_id" uuid null,
        "name_snapshot" text not null,
        "part_code_snapshot" text null,
        "quantity_proposed" decimal not null default 0,
        "quantity_used" decimal not null default 0,
        "unit" text null,
        "unit_price_snapshot" decimal null,
        "is_billable" boolean not null default false,
        "line_status" text not null default 'proposed',
        "notes" text null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "service_protocol_parts_pkey" primary key ("id")
      );
    `)

    // service_protocol_history
    this.addSql(`
      create table if not exists "service_protocol_history" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "protocol_id" uuid not null,
        "event_type" text not null,
        "old_value" jsonb null,
        "new_value" jsonb null,
        "performed_by_user_id" uuid null,
        "performed_at" timestamptz not null,
        "notes" text null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "service_protocol_history_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "sph_protocol_idx" on "service_protocol_history" ("protocol_id");`)

    // Foreign keys
    this.addSql(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'service_protocol_technicians_protocol_id_foreign') then
          alter table "service_protocol_technicians" add constraint "service_protocol_technicians_protocol_id_foreign"
            foreign key ("protocol_id") references "service_protocols" ("id") on update cascade;
        end if;
      end $$;
    `)
    this.addSql(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'service_protocol_parts_protocol_id_foreign') then
          alter table "service_protocol_parts" add constraint "service_protocol_parts_protocol_id_foreign"
            foreign key ("protocol_id") references "service_protocols" ("id") on update cascade;
        end if;
      end $$;
    `)
    this.addSql(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'service_protocol_history_protocol_id_foreign') then
          alter table "service_protocol_history" add constraint "service_protocol_history_protocol_id_foreign"
            foreign key ("protocol_id") references "service_protocols" ("id") on update cascade;
        end if;
      end $$;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "service_protocol_technicians" drop constraint if exists "service_protocol_technicians_protocol_id_foreign";`)
    this.addSql(`alter table "service_protocol_parts" drop constraint if exists "service_protocol_parts_protocol_id_foreign";`)
    this.addSql(`alter table "service_protocol_history" drop constraint if exists "service_protocol_history_protocol_id_foreign";`)
    this.addSql(`drop table if exists "service_protocol_history";`)
    this.addSql(`drop table if exists "service_protocol_parts";`)
    this.addSql(`drop table if exists "service_protocol_technicians";`)
    this.addSql(`drop table if exists "service_protocols";`)
  }
}
