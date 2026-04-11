import { Migration } from '@mikro-orm/migrations';

export class Migration20260411100002 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "machine_catalog_profiles" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "catalog_product_id" uuid not null,
      "machine_family" text null,
      "model_code" text null,
      "supported_service_types" jsonb null,
      "required_skills" jsonb null,
      "required_certifications" jsonb null,
      "default_team_size" int null,
      "default_service_duration_minutes" int null,
      "preventive_maintenance_interval_days" int null,
      "default_warranty_months" int null,
      "startup_notes" text null,
      "service_notes" text null,
      "is_active" boolean not null default true,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "deleted_at" timestamptz null,
      constraint "machine_catalog_profiles_pkey" primary key ("id")
    );`);

    this.addSql(`create index "machine_catalog_profiles_tenant_org_idx" on "machine_catalog_profiles" ("tenant_id", "organization_id");`);
    this.addSql(`create index "machine_catalog_profiles_product_idx" on "machine_catalog_profiles" ("catalog_product_id");`);

    this.addSql(`create table "machine_catalog_part_templates" (
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
    );`);

    this.addSql(`create index "machine_catalog_part_templates_profile_idx" on "machine_catalog_part_templates" ("machine_profile_id");`);
    this.addSql(`create index "machine_catalog_part_templates_tenant_org_idx" on "machine_catalog_part_templates" ("tenant_id", "organization_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "machine_catalog_part_templates_tenant_org_idx";`);
    this.addSql(`drop index "machine_catalog_part_templates_profile_idx";`);
    this.addSql(`drop table "machine_catalog_part_templates";`);
    this.addSql(`drop index "machine_catalog_profiles_product_idx";`);
    this.addSql(`drop index "machine_catalog_profiles_tenant_org_idx";`);
    this.addSql(`drop table "machine_catalog_profiles";`);
  }

}
