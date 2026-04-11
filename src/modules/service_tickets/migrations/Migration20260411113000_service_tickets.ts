import { Migration } from '@mikro-orm/migrations'

export class Migration20260411113000_service_tickets extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (
          select 1
          from information_schema.columns
          where table_name = 'service_tickets'
            and column_name = 'machine_asset_id'
        ) and not exists (
          select 1
          from information_schema.columns
          where table_name = 'service_tickets'
            and column_name = 'machine_instance_id'
        ) then
          alter table "service_tickets" rename column "machine_asset_id" to "machine_instance_id";
        end if;
      end
      $$;
    `)

    this.addSql(`drop index if exists "st_machine_idx";`)
    this.addSql(`create index if not exists "st_machine_idx" on "service_tickets" ("machine_instance_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (
          select 1
          from information_schema.columns
          where table_name = 'service_tickets'
            and column_name = 'machine_instance_id'
        ) and not exists (
          select 1
          from information_schema.columns
          where table_name = 'service_tickets'
            and column_name = 'machine_asset_id'
        ) then
          alter table "service_tickets" rename column "machine_instance_id" to "machine_asset_id";
        end if;
      end
      $$;
    `)

    this.addSql(`drop index if exists "st_machine_idx";`)
    this.addSql(`create index if not exists "st_machine_idx" on "service_tickets" ("machine_asset_id");`)
  }

}
