import { Migration } from '@mikro-orm/migrations'

export class Migration20260412100001_role_acls extends Migration {

  override async up(): Promise<void> {
    // Backfill admin role with technician_schedule.view + technician_schedule.manage
    this.addSql(`
      update "role_acls" as ra
      set
        "features_json" = case
          when ra."features_json" is null or jsonb_typeof(ra."features_json") <> 'array'
            then '["technician_schedule.view","technician_schedule.manage"]'::jsonb
          when ra."features_json" ? 'technician_schedule.manage'
            then ra."features_json"
          when ra."features_json" ? 'technician_schedule.view'
            then ra."features_json" || '"technician_schedule.manage"'::jsonb
          else ra."features_json" || '["technician_schedule.view","technician_schedule.manage"]'::jsonb
        end,
        "updated_at" = now()
      from "roles" as r
      where ra."role_id" = r."id"
        and ra."deleted_at" is null
        and r."deleted_at" is null
        and r."name" = 'admin'
        and (
          ra."features_json" is null
          or jsonb_typeof(ra."features_json") <> 'array'
          or not (ra."features_json" ? 'technician_schedule.view')
          or not (ra."features_json" ? 'technician_schedule.manage')
        );
    `)

    // Backfill employee role with technician_schedule.view only
    this.addSql(`
      update "role_acls" as ra
      set
        "features_json" = case
          when ra."features_json" is null or jsonb_typeof(ra."features_json") <> 'array'
            then '["technician_schedule.view"]'::jsonb
          else ra."features_json" || '"technician_schedule.view"'::jsonb
        end,
        "updated_at" = now()
      from "roles" as r
      where ra."role_id" = r."id"
        and ra."deleted_at" is null
        and r."deleted_at" is null
        and r."name" = 'employee'
        and (
          ra."features_json" is null
          or jsonb_typeof(ra."features_json") <> 'array'
          or not (ra."features_json" ? 'technician_schedule.view')
        );
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      update "role_acls" as ra
      set
        "features_json" = coalesce(
          (
            select jsonb_agg(feature)
            from jsonb_array_elements_text(ra."features_json") as feature
            where feature not in ('technician_schedule.view', 'technician_schedule.manage')
          ),
          '[]'::jsonb
        ),
        "updated_at" = now()
      from "roles" as r
      where ra."role_id" = r."id"
        and ra."deleted_at" is null
        and r."deleted_at" is null
        and r."name" in ('admin', 'employee')
        and ra."features_json" is not null
        and jsonb_typeof(ra."features_json") = 'array'
        and (
          ra."features_json" ? 'technician_schedule.view'
          or ra."features_json" ? 'technician_schedule.manage'
        );
    `)
  }

}
