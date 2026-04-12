import { Migration } from '@mikro-orm/migrations'

export class Migration20260412153000_service_ticket_source extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "technician_reservations" add column "source_ticket_id" uuid null;`)
    this.addSql(`create index "technician_reservations_source_ticket_idx" on "technician_reservations" ("source_ticket_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "technician_reservations_source_ticket_idx";`)
    this.addSql(`alter table "technician_reservations" drop column if exists "source_ticket_id";`)
  }

}
