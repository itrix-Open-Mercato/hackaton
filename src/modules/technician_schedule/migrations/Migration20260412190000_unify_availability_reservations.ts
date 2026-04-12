import { Migration } from '@mikro-orm/migrations'

export class Migration20260412190000_unify_availability_reservations extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "technician_reservations" add column "entry_kind" text not null default 'reservation';`)
    this.addSql(`alter table "technician_reservations" add column "availability_type" text null;`)
    this.addSql(`alter table "technician_reservations" add column "all_day" boolean not null default false;`)
    this.addSql(`alter table "technician_reservations" alter column "reservation_type" drop not null;`)
    this.addSql(`create index "technician_reservations_entry_kind_idx" on "technician_reservations" ("tenant_id", "organization_id", "entry_kind");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "technician_reservations_entry_kind_idx";`)
    this.addSql(`alter table "technician_reservations" alter column "reservation_type" set not null;`)
    this.addSql(`alter table "technician_reservations" drop column if exists "all_day";`)
    this.addSql(`alter table "technician_reservations" drop column if exists "availability_type";`)
    this.addSql(`alter table "technician_reservations" drop column if exists "entry_kind";`)
  }

}
