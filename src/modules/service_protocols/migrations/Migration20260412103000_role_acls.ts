import { Migration } from '@mikro-orm/migrations'

export class Migration20260412103000_role_acls extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      update "role_acls" as ra
      set
        "features_json" = case
          when ra."features_json" is null or jsonb_typeof(ra."features_json") <> 'array'
            then '["service_protocols.view"]'::jsonb
          when ra."features_json" ? 'service_protocols.view'
            then ra."features_json"
          else ra."features_json" || '"service_protocols.view"'::jsonb
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
          or not (ra."features_json" ? 'service_protocols.view')
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
            where feature <> 'service_protocols.view'
          ),
          '[]'::jsonb
        ),
        "updated_at" = now()
      from "roles" as r
      where ra."role_id" = r."id"
        and ra."deleted_at" is null
        and r."deleted_at" is null
        and r."name" = 'employee'
        and ra."features_json" is not null
        and jsonb_typeof(ra."features_json") = 'array'
        and ra."features_json" ? 'service_protocols.view';
    `)
  }

}
