import { Migration } from '@mikro-orm/migrations'

export class Migration20260411200000_machine_catalog_service_types extends Migration {

  override async up(): Promise<void> {
    // 1. Drop old part templates table (replaced by machine_catalog_service_type_parts)
    this.addSql(`drop table if exists "machine_catalog_part_templates";`)

    // 2. Remove per-service-type fields from profiles (now on MachineCatalogServiceType)
    this.addSql(`alter table "machine_catalog_profiles"
      drop column if exists "supported_service_types",
      drop column if exists "required_skills",
      drop column if exists "required_certifications",
      drop column if exists "default_team_size",
      drop column if exists "default_service_duration_minutes",
      drop column if exists "startup_notes",
      drop column if exists "service_notes";`)

    // 3. Create machine_catalog_service_types
    this.addSql(`create table if not exists "machine_catalog_service_types" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "machine_profile_id" uuid not null,
      "service_type" text not null,
      "default_team_size" int null,
      "default_service_duration_minutes" int null,
      "startup_notes" text null,
      "service_notes" text null,
      "sort_order" int not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "machine_catalog_service_types_pkey" primary key ("id")
    );`)

    this.addSql(`create index if not exists "mcat_st_tenant_org_idx" on "machine_catalog_service_types" ("tenant_id", "organization_id");`)
    this.addSql(`create index if not exists "mcat_st_profile_idx" on "machine_catalog_service_types" ("machine_profile_id");`)

    // 4. Create machine_catalog_service_type_skills
    this.addSql(`create table if not exists "machine_catalog_service_type_skills" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "machine_service_type_id" uuid not null,
      "skill_name" text not null,
      "created_at" timestamptz not null default now(),
      constraint "machine_catalog_service_type_skills_pkey" primary key ("id"),
      constraint "mcat_sts_unique" unique ("machine_service_type_id", "skill_name")
    );`)

    this.addSql(`create index if not exists "mcat_sts_service_type_idx" on "machine_catalog_service_type_skills" ("machine_service_type_id");`)

    // 5. Create machine_catalog_service_type_certifications
    this.addSql(`create table if not exists "machine_catalog_service_type_certifications" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "machine_service_type_id" uuid not null,
      "certification_name" text not null,
      "created_at" timestamptz not null default now(),
      constraint "machine_catalog_service_type_certifications_pkey" primary key ("id"),
      constraint "mcat_stc_unique" unique ("machine_service_type_id", "certification_name")
    );`)

    this.addSql(`create index if not exists "mcat_stc_service_type_idx" on "machine_catalog_service_type_certifications" ("machine_service_type_id");`)

    // 6. Create machine_catalog_service_type_parts
    this.addSql(`create table if not exists "machine_catalog_service_type_parts" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "machine_service_type_id" uuid not null,
      "catalog_product_id" uuid not null,
      "quantity" numeric(10, 3) not null,
      "sort_order" int not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "machine_catalog_service_type_parts_pkey" primary key ("id")
    );`)

    this.addSql(`create index if not exists "mcat_stp_service_type_idx" on "machine_catalog_service_type_parts" ("machine_service_type_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "machine_catalog_service_type_parts";`)
    this.addSql(`drop table if exists "machine_catalog_service_type_certifications";`)
    this.addSql(`drop table if exists "machine_catalog_service_type_skills";`)
    this.addSql(`drop table if exists "machine_catalog_service_types";`)

    this.addSql(`alter table "machine_catalog_profiles"
      add column if not exists "supported_service_types" jsonb null,
      add column if not exists "required_skills" jsonb null,
      add column if not exists "required_certifications" jsonb null,
      add column if not exists "default_team_size" int null,
      add column if not exists "default_service_duration_minutes" int null,
      add column if not exists "startup_notes" text null,
      add column if not exists "service_notes" text null;`)

    this.addSql(`create table if not exists "machine_catalog_part_templates" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "machine_profile_id" uuid not null,
      "part_catalog_product_id" uuid null,
      "template_type" text not null,
      "service_context" text null,
      "kit_name" text null,
      "part_name" text not null,
      "part_code" text null,
      "quantity_default" numeric(10, 3) null,
      "quantity_unit" text null,
      "sort_order" int not null default 0,
      "notes" text null,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "deleted_at" timestamptz null,
      constraint "machine_catalog_part_templates_pkey" primary key ("id")
    );`)
  }

}
