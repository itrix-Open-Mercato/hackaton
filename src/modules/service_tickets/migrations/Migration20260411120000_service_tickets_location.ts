import { Migration } from '@mikro-orm/migrations'

export class Migration20260411120000_service_tickets_location extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "service_tickets" add column if not exists "latitude" float8 null;`)
    this.addSql(`alter table "service_tickets" add column if not exists "longitude" float8 null;`)
    this.addSql(`alter table "service_tickets" add column if not exists "location_source" text null;`)
    this.addSql(`alter table "service_tickets" add column if not exists "geocoded_address" text null;`)
    this.addSql(`alter table "service_tickets" add column if not exists "location_updated_at" timestamptz null;`)
    this.addSql(`create index if not exists "st_location_idx" on "service_tickets" ("latitude", "longitude") where "latitude" is not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "st_location_idx";`)
    this.addSql(`alter table "service_tickets" drop column if exists "location_updated_at";`)
    this.addSql(`alter table "service_tickets" drop column if exists "geocoded_address";`)
    this.addSql(`alter table "service_tickets" drop column if exists "location_source";`)
    this.addSql(`alter table "service_tickets" drop column if exists "longitude";`)
    this.addSql(`alter table "service_tickets" drop column if exists "latitude";`)
  }
}
