import { Migration } from '@mikro-orm/migrations';

export class Migration20260411180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "technician_reservations" (
      "id" uuid not null default gen_random_uuid(),
      "organization_id" uuid not null,
      "tenant_id" uuid not null,
      "title" text not null,
      "reservation_type" text not null,
      "status" text not null default 'confirmed',
      "source_type" text not null default 'manual',
      "source_order_id" uuid null,
      "starts_at" timestamptz not null,
      "ends_at" timestamptz not null,
      "vehicle_id" uuid null,
      "vehicle_label" text null,
      "customer_name" text null,
      "address" text null,
      "notes" text null,
      "is_active" boolean not null default true,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "deleted_at" timestamptz null,
      constraint "technician_reservations_pkey" primary key ("id")
    );`);
    this.addSql(`create index "technician_reservations_tenant_org_idx" on "technician_reservations" ("tenant_id", "organization_id");`);
    this.addSql(`create index "technician_reservations_window_idx" on "technician_reservations" ("tenant_id", "organization_id", "starts_at", "ends_at");`);
    this.addSql(`create index "technician_reservations_source_order_idx" on "technician_reservations" ("source_order_id");`);

    this.addSql(`create table "technician_reservation_technicians" (
      "id" uuid not null default gen_random_uuid(),
      "reservation_id" uuid not null,
      "technician_id" uuid not null,
      "organization_id" uuid not null,
      "tenant_id" uuid not null,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      constraint "technician_reservation_technicians_pkey" primary key ("id")
    );`);
    this.addSql(`create index "technician_reservation_technicians_reservation_idx" on "technician_reservation_technicians" ("reservation_id");`);
    this.addSql(`create unique index "technician_reservation_technicians_unique_idx" on "technician_reservation_technicians" ("technician_id", "reservation_id");`);
    this.addSql(`create index "technician_reservation_technicians_tenant_org_technician_idx" on "technician_reservation_technicians" ("tenant_id", "organization_id", "technician_id");`);

    this.addSql(`alter table "technician_reservation_technicians" add constraint "technician_reservation_technicians_reservation_id_foreign" foreign key ("reservation_id") references "technician_reservations" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "technician_reservation_technicians" drop constraint "technician_reservation_technicians_reservation_id_foreign";`);
    this.addSql(`drop table if exists "technician_reservation_technicians";`);
    this.addSql(`drop table if exists "technician_reservations";`);
  }

}
