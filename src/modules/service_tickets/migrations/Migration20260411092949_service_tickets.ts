import { Migration } from '@mikro-orm/migrations';

export class Migration20260411092949_service_tickets extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "service_tickets" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "ticket_number" text not null, "service_type" text not null, "status" text not null default 'new', "priority" text not null default 'normal', "description" text null, "visit_date" timestamptz null, "visit_end_date" timestamptz null, "address" text null, "customer_entity_id" uuid null, "contact_person_id" uuid null, "machine_asset_id" uuid null, "order_id" uuid null, "created_by_user_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "service_tickets_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "st_tenant_org_idx" on "service_tickets" ("tenant_id", "organization_id");`);
    this.addSql(`create index if not exists "st_status_tenant_org_idx" on "service_tickets" ("status", "tenant_id", "organization_id");`);
    this.addSql(`create index if not exists "st_customer_idx" on "service_tickets" ("customer_entity_id");`);
    this.addSql(`create index if not exists "st_contact_person_idx" on "service_tickets" ("contact_person_id");`);
    this.addSql(`create index if not exists "st_machine_idx" on "service_tickets" ("machine_asset_id");`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'st_ticket_number_unique') then alter table "service_tickets" add constraint "st_ticket_number_unique" unique ("ticket_number", "tenant_id", "organization_id"); end if; end $$;`);

    this.addSql(`create table if not exists "service_ticket_assignments" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "ticket_id" uuid not null, "staff_member_id" uuid not null, "created_at" timestamptz not null, constraint "service_ticket_assignments_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "sta_staff_idx" on "service_ticket_assignments" ("staff_member_id");`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'sta_ticket_staff_unique') then alter table "service_ticket_assignments" add constraint "sta_ticket_staff_unique" unique ("ticket_id", "staff_member_id"); end if; end $$;`);

    this.addSql(`create table if not exists "service_ticket_parts" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "ticket_id" uuid not null, "product_id" uuid not null, "quantity" integer not null default 1, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "service_ticket_parts_pkey" primary key ("id"));`);

    this.addSql(`create table if not exists "service_ticket_date_changes" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "ticket_id" uuid not null, "old_date" timestamptz null, "new_date" timestamptz null, "reason" text null, "changed_by_user_id" uuid null, "created_at" timestamptz not null, constraint "service_ticket_date_changes_pkey" primary key ("id"));`);

    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_ticket_assignments_ticket_id_foreign') then alter table "service_ticket_assignments" add constraint "service_ticket_assignments_ticket_id_foreign" foreign key ("ticket_id") references "service_tickets" ("id") on update cascade; end if; end $$;`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_ticket_parts_ticket_id_foreign') then alter table "service_ticket_parts" add constraint "service_ticket_parts_ticket_id_foreign" foreign key ("ticket_id") references "service_tickets" ("id") on update cascade; end if; end $$;`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_ticket_date_changes_ticket_id_foreign') then alter table "service_ticket_date_changes" add constraint "service_ticket_date_changes_ticket_id_foreign" foreign key ("ticket_id") references "service_tickets" ("id") on update cascade; end if; end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "service_ticket_assignments" drop constraint if exists "service_ticket_assignments_ticket_id_foreign";`);
    this.addSql(`alter table "service_ticket_parts" drop constraint if exists "service_ticket_parts_ticket_id_foreign";`);
    this.addSql(`alter table "service_ticket_date_changes" drop constraint if exists "service_ticket_date_changes_ticket_id_foreign";`);
    this.addSql(`drop table if exists "service_ticket_date_changes";`);
    this.addSql(`drop table if exists "service_ticket_parts";`);
    this.addSql(`drop table if exists "service_ticket_assignments";`);
    this.addSql(`drop table if exists "service_tickets";`);
  }

}
