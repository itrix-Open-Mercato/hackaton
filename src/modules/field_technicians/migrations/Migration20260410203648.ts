import { Migration } from '@mikro-orm/migrations';

export class Migration20260410203648 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "field_technicians" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "display_name" text not null, "first_name" text null, "last_name" text null, "email" text null, "phone" text null, "location_status" text not null default 'in_office', "skills" jsonb not null default '[]', "languages" jsonb not null default '[]', "notes" text null, "staff_member_id" uuid null, "vehicle_id" uuid null, "vehicle_label" text null, "current_order_id" uuid null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "field_technicians_pkey" primary key ("id"));`);
    this.addSql(`create index "field_technicians_tenant_org_idx" on "field_technicians" ("tenant_id", "organization_id");`);
    this.addSql(`create index "field_technicians_is_active_idx" on "field_technicians" ("tenant_id", "organization_id", "is_active");`);

    this.addSql(`create table "field_technician_certifications" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "technician_id" uuid not null, "name" text not null, "cert_type" text null, "code" text null, "issued_at" timestamptz null, "expires_at" timestamptz null, "issued_by" text null, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "field_technician_certifications_pkey" primary key ("id"));`);
    this.addSql(`create index "field_technician_certs_technician_idx" on "field_technician_certifications" ("technician_id");`);
    this.addSql(`create index "field_technician_certs_tenant_org_idx" on "field_technician_certifications" ("tenant_id", "organization_id");`);
    this.addSql(`create index "field_technician_certs_expires_idx" on "field_technician_certifications" ("tenant_id", "organization_id", "expires_at");`);

    this.addSql(`alter table "field_technician_certifications" add constraint "field_technician_certifications_technician_id_foreign" foreign key ("technician_id") references "field_technicians" ("id") on update cascade on delete no action;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "field_technician_certifications" drop constraint "field_technician_certifications_technician_id_foreign";`);
    this.addSql(`drop table if exists "field_technician_certifications";`);
    this.addSql(`drop table if exists "field_technicians";`);
  }

}
