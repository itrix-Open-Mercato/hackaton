import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core'

/**
 * Machine profile — extends catalog.product 1:1 with machine-specific metadata.
 * Lives in machine_catalog module (overlay), linked to core catalog via catalogProductId (FK only).
 */
@Entity({ tableName: 'machine_catalog_profiles' })
@Index({ name: 'machine_catalog_profiles_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'machine_catalog_profiles_product_idx', properties: ['catalogProductId'] })
export class MachineCatalogProfile {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // Link to core catalog product — FK ID only, no ORM relation
  @Property({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string

  // Machine classification
  @Property({ name: 'machine_family', type: 'text', nullable: true })
  machineFamily?: string | null

  @Property({ name: 'model_code', type: 'text', nullable: true })
  modelCode?: string | null

  // Service requirements (stored as JSON arrays)
  @Property({ name: 'supported_service_types', type: 'jsonb', nullable: true })
  supportedServiceTypes?: string[] | null

  @Property({ name: 'required_skills', type: 'jsonb', nullable: true })
  requiredSkills?: string[] | null

  @Property({ name: 'required_certifications', type: 'jsonb', nullable: true })
  requiredCertifications?: string[] | null

  // Service defaults
  @Property({ name: 'default_team_size', type: 'int', nullable: true })
  defaultTeamSize?: number | null

  @Property({ name: 'default_service_duration_minutes', type: 'int', nullable: true })
  defaultServiceDurationMinutes?: number | null

  @Property({ name: 'preventive_maintenance_interval_days', type: 'int', nullable: true })
  preventiveMaintenanceIntervalDays?: number | null

  @Property({ name: 'default_warranty_months', type: 'int', nullable: true })
  defaultWarrantyMonths?: number | null

  // Notes
  @Property({ name: 'startup_notes', type: 'text', nullable: true })
  startupNotes?: string | null

  @Property({ name: 'service_notes', type: 'text', nullable: true })
  serviceNotes?: string | null

  // Standard columns
  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/**
 * Machine part template — default service kit items for a machine profile.
 * e.g. "Zestaw A – przegląd 6-miesięczny" from przykladowe_maszyny.md
 */
@Entity({ tableName: 'machine_catalog_part_templates' })
@Index({ name: 'machine_catalog_part_templates_profile_idx', properties: ['machineProfileId'] })
@Index({ name: 'machine_catalog_part_templates_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class MachineCatalogPartTemplate {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // Link to machine profile — FK ID only, no ORM relation
  @Property({ name: 'machine_profile_id', type: 'uuid' })
  machineProfileId!: string

  // Link to catalog product (the part/component) — FK ID only
  @Property({ name: 'part_catalog_product_id', type: 'uuid', nullable: true })
  partCatalogProductId?: string | null

  // Template classification
  @Property({ name: 'template_type', type: 'text' })
  templateType!: string  // 'component' | 'consumable' | 'service_kit_item'

  @Property({ name: 'service_context', type: 'text', nullable: true })
  serviceContext?: string | null  // 'startup' | 'preventive' | 'repair' | 'reclamation'

  @Property({ name: 'kit_name', type: 'text', nullable: true })
  kitName?: string | null  // e.g. "Zestaw serwisowy A"

  // Part details (snapshot from catalog or manual)
  @Property({ name: 'part_name', type: 'text' })
  partName!: string

  @Property({ name: 'part_code', type: 'text', nullable: true })
  partCode?: string | null  // e.g. PRD-FLT-OH12

  @Property({ name: 'quantity_default', type: 'decimal', precision: 10, scale: 3, nullable: true })
  quantityDefault?: number | null

  @Property({ name: 'quantity_unit', type: 'text', nullable: true })
  quantityUnit?: string | null  // 'szt.' | 'l' | 'g' | 'kpl.'

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null

  // Standard columns
  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
