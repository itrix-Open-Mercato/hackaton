import { Entity, PrimaryKey, Property, Index, Unique, OptionalProps } from '@mikro-orm/core'

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

  // Service schedule defaults (not per-service-type)
  @Property({ name: 'preventive_maintenance_interval_days', type: 'int', nullable: true })
  preventiveMaintenanceIntervalDays?: number | null

  @Property({ name: 'default_warranty_months', type: 'int', nullable: true })
  defaultWarrantyMonths?: number | null

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
 * Per-service-type configuration for a machine profile.
 * Replaces the flat supportedServiceTypes/requiredSkills/etc. fields.
 * One row per service type per profile (e.g. "regular", "commissioning").
 */
@Entity({ tableName: 'machine_catalog_service_types' })
@Index({ name: 'mcat_st_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'mcat_st_profile_idx', properties: ['machineProfileId'] })
export class MachineCatalogServiceType {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // FK → machine_catalog_profiles.id — FK ID only
  @Property({ name: 'machine_profile_id', type: 'uuid' })
  machineProfileId!: string

  // Free-text service type label, e.g. "regular", "commissioning", "warranty"
  @Property({ name: 'service_type', type: 'text' })
  serviceType!: string

  @Property({ name: 'default_team_size', type: 'int', nullable: true })
  defaultTeamSize?: number | null

  @Property({ name: 'default_service_duration_minutes', type: 'int', nullable: true })
  defaultServiceDurationMinutes?: number | null

  @Property({ name: 'startup_notes', type: 'text', nullable: true })
  startupNotes?: string | null

  @Property({ name: 'service_notes', type: 'text', nullable: true })
  serviceNotes?: string | null

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/**
 * Required skill junction — soft-references technician_skills.name by text.
 * Autosuggest pulls DISTINCT name from technician_skills within the org.
 */
@Entity({ tableName: 'machine_catalog_service_type_skills' })
@Index({ name: 'mcat_sts_service_type_idx', properties: ['machineServiceTypeId'] })
@Unique({ name: 'mcat_sts_unique', properties: ['machineServiceTypeId', 'skillName'] })
export class MachineCatalogServiceTypeSkill {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // FK → machine_catalog_service_types.id — FK ID only
  @Property({ name: 'machine_service_type_id', type: 'uuid' })
  machineServiceTypeId!: string

  @Property({ name: 'skill_name', type: 'text' })
  skillName!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

/**
 * Required certification junction — soft-references technician_certifications.name by text.
 * Autosuggest pulls DISTINCT name from technician_certifications within the org.
 */
@Entity({ tableName: 'machine_catalog_service_type_certifications' })
@Index({ name: 'mcat_stc_service_type_idx', properties: ['machineServiceTypeId'] })
@Unique({ name: 'mcat_stc_unique', properties: ['machineServiceTypeId', 'certificationName'] })
export class MachineCatalogServiceTypeCertification {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // FK → machine_catalog_service_types.id — FK ID only
  @Property({ name: 'machine_service_type_id', type: 'uuid' })
  machineServiceTypeId!: string

  @Property({ name: 'certification_name', type: 'text' })
  certificationName!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

/**
 * Service part required for a given service type.
 * Replaces MachineCatalogPartTemplate — simpler model: catalog product + quantity per service type.
 */
@Entity({ tableName: 'machine_catalog_service_type_parts' })
@Index({ name: 'mcat_stp_service_type_idx', properties: ['machineServiceTypeId'] })
export class MachineCatalogServiceTypePart {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // FK → machine_catalog_service_types.id — FK ID only
  @Property({ name: 'machine_service_type_id', type: 'uuid' })
  machineServiceTypeId!: string

  // FK → catalog product — FK ID only
  @Property({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string

  @Property({ name: 'quantity', type: 'decimal', precision: 10, scale: 3 })
  quantity!: number

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
