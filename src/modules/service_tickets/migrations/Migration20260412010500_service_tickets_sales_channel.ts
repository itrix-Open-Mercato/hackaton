import { Migration } from '@mikro-orm/migrations'

export class Migration20260412010500_service_tickets_sales_channel extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "service_tickets" add column if not exists "sales_channel_id" uuid null;`)
    this.addSql(`create index if not exists "st_sales_channel_idx" on "service_tickets" ("sales_channel_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "st_sales_channel_idx";`)
    this.addSql(`alter table "service_tickets" drop column if exists "sales_channel_id";`)
  }
}
