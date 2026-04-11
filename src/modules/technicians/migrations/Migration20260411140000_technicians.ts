import { Migration } from '@mikro-orm/migrations';

export class Migration20260411140000_technicians extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "technicians" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "staff_member_id" uuid not null, "is_active" boolean not null default true, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "technicians_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "tech_tenant_org_idx" on "technicians" ("tenant_id", "organization_id");`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'tech_staff_member_unique') then alter table "technicians" add constraint "tech_staff_member_unique" unique ("staff_member_id", "tenant_id", "organization_id"); end if; end $$;`);

    this.addSql(`create table if not exists "technician_skills" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "technician_id" uuid not null, "name" text not null, "created_at" timestamptz not null, constraint "technician_skills_pkey" primary key ("id"));`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'ts_technician_name_unique') then alter table "technician_skills" add constraint "ts_technician_name_unique" unique ("technician_id", "name"); end if; end $$;`);

    this.addSql(`create table if not exists "technician_certifications" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "technician_id" uuid not null, "name" text not null, "certificate_number" text null, "issued_at" timestamptz null, "expires_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "technician_certifications_pkey" primary key ("id"));`);

    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'technician_skills_technician_id_foreign') then alter table "technician_skills" add constraint "technician_skills_technician_id_foreign" foreign key ("technician_id") references "technicians" ("id") on update cascade; end if; end $$;`);
    this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'technician_certifications_technician_id_foreign') then alter table "technician_certifications" add constraint "technician_certifications_technician_id_foreign" foreign key ("technician_id") references "technicians" ("id") on update cascade; end if; end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "technician_certifications" drop constraint if exists "technician_certifications_technician_id_foreign";`);
    this.addSql(`alter table "technician_skills" drop constraint if exists "technician_skills_technician_id_foreign";`);
    this.addSql(`drop table if exists "technician_certifications";`);
    this.addSql(`drop table if exists "technician_skills";`);
    this.addSql(`drop table if exists "technicians";`);
  }

}
