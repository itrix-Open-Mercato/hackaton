import { Migration } from '@mikro-orm/migrations';

export class Migration20260411100001 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "machine_instances" (
      "id" uuid not null default gen_random_uuid(),
      "tenant_id" uuid not null,
      "organization_id" uuid not null,
      "catalog_product_id" uuid null,
      "instance_code" text not null,
      "serial_number" text null,
      "customer_company_id" uuid null,
      "site_name" text null,
      "site_address" jsonb null,
      "location_label" text null,
      "contact_name" text null,
      "contact_phone" text null,
      "manufactured_at" date null,
      "commissioned_at" date null,
      "warranty_until" date null,
      "warranty_status" text null,
      "last_inspection_at" date null,
      "next_inspection_at" date null,
      "service_count" int null,
      "complaint_count" int null,
      "last_service_case_code" text null,
      "requires_announcement" boolean not null default false,
      "announcement_lead_time_hours" int null,
      "instance_notes" text null,
      "is_active" boolean not null default true,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "deleted_at" timestamptz null,
      constraint "machine_instances_pkey" primary key ("id")
    );`);

    this.addSql(`create index "machine_instances_tenant_org_idx" on "machine_instances" ("tenant_id", "organization_id");`);
    this.addSql(`create index "machine_instances_customer_idx" on "machine_instances" ("customer_company_id");`);
    this.addSql(`create index "machine_instances_product_idx" on "machine_instances" ("catalog_product_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "machine_instances_product_idx";`);
    this.addSql(`drop index "machine_instances_customer_idx";`);
    this.addSql(`drop index "machine_instances_tenant_org_idx";`);
    this.addSql(`drop table "machine_instances";`);
  }

}
