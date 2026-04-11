import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core'

@Entity({ tableName: 'machine_instances' })
@Index({ name: 'machine_instances_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'machine_instances_customer_idx', properties: ['customerCompanyId'] })
@Index({ name: 'machine_instances_product_idx', properties: ['catalogProductId'] })
export class MachineInstance {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  // Link to catalog product (machine template) — FK ID only, no ORM relation
  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

  // Instance identity
  @Property({ name: 'instance_code', type: 'text' })
  instanceCode!: string

  @Property({ name: 'serial_number', type: 'text', nullable: true })
  serialNumber?: string | null

  // Customer assignment — FK ID only, no ORM relation
  @Property({ name: 'customer_company_id', type: 'uuid', nullable: true })
  customerCompanyId?: string | null

  // Location
  @Property({ name: 'site_name', type: 'text', nullable: true })
  siteName?: string | null

  @Property({ name: 'site_address', type: 'jsonb', nullable: true })
  siteAddress?: Record<string, unknown> | null

  @Property({ name: 'location_label', type: 'text', nullable: true })
  locationLabel?: string | null

  // Contact at customer site
  @Property({ name: 'contact_name', type: 'text', nullable: true })
  contactName?: string | null

  @Property({ name: 'contact_phone', type: 'text', nullable: true })
  contactPhone?: string | null

  // Dates
  @Property({ name: 'manufactured_at', type: 'date', nullable: true })
  manufacturedAt?: Date | null

  @Property({ name: 'commissioned_at', type: 'date', nullable: true })
  commissionedAt?: Date | null

  // Warranty
  @Property({ name: 'warranty_until', type: 'date', nullable: true })
  warrantyUntil?: Date | null

  @Property({ name: 'warranty_status', type: 'text', nullable: true })
  warrantyStatus?: string | null

  // Inspection
  @Property({ name: 'last_inspection_at', type: 'date', nullable: true })
  lastInspectionAt?: Date | null

  @Property({ name: 'next_inspection_at', type: 'date', nullable: true })
  nextInspectionAt?: Date | null

  // Service history (denormalized counters)
  @Property({ name: 'service_count', type: 'int', nullable: true })
  serviceCount?: number | null

  @Property({ name: 'complaint_count', type: 'int', nullable: true })
  complaintCount?: number | null

  @Property({ name: 'last_service_case_code', type: 'text', nullable: true })
  lastServiceCaseCode?: string | null

  // Access / announcement
  @Property({ name: 'requires_announcement', type: 'boolean', default: false })
  requiresAnnouncement: boolean = false

  @Property({ name: 'announcement_lead_time_hours', type: 'int', nullable: true })
  announcementLeadTimeHours?: number | null

  @Property({ name: 'instance_notes', type: 'text', nullable: true })
  instanceNotes?: string | null

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
