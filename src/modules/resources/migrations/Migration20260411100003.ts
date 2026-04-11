import { Migration } from '@mikro-orm/migrations';

export class Migration20260411100003 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "resources_resource_types" add column "catalog_product_id" uuid null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "resources_resource_types" drop column "catalog_product_id";`);
  }

}
