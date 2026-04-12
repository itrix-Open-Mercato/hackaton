import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  ManyToOne,
  OptionalProps,
} from '@mikro-orm/core'

export type TechnicianLocationStatus = 'in_office' | 'on_trip' | 'at_client' | 'unavailable'

@Entity({ tableName: 'technicians' })
@Index({ name: 'tech_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Unique({ name: 'tech_staff_member_unique', properties: ['staffMemberId', 'tenantId', 'organizationId'] })
export class Technician {
  [OptionalProps]?: 'isActive' | 'locationStatus' | 'languages' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'staff_member_id', type: 'uuid' })
  staffMemberId!: string

  @Property({ name: 'display_name', type: 'text', nullable: true })
  displayName?: string | null

  @Property({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string | null

  @Property({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string | null

  @Property({ type: 'text', nullable: true })
  email?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ name: 'location_status', type: 'text', default: 'in_office' })
  locationStatus: TechnicianLocationStatus = 'in_office'

  @Property({ type: 'jsonb', default: [] })
  languages: string[] = []

  @Property({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null

  @Property({ name: 'vehicle_label', type: 'text', nullable: true })
  vehicleLabel?: string | null

  @Property({ name: 'current_order_id', type: 'uuid', nullable: true })
  currentOrderId?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'technician_skills' })
@Unique({ name: 'ts_technician_name_unique', properties: ['technician', 'name'] })
export class TechnicianSkill {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => Technician, { fieldName: 'technician_id' })
  technician!: Technician

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'technician_certifications' })
export class TechnicianCertification {
  [OptionalProps]?: 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => Technician, { fieldName: 'technician_id' })
  technician!: Technician

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'cert_type', type: 'text', nullable: true })
  certType?: string | null

  @Property({ name: 'certificate_number', type: 'text', nullable: true })
  certificateNumber?: string | null

  @Property({ type: 'text', nullable: true })
  code?: string | null

  @Property({ name: 'issued_at', type: Date, nullable: true })
  issuedAt?: Date | null

  @Property({ name: 'expires_at', type: Date, nullable: true })
  expiresAt?: Date | null

  @Property({ name: 'issued_by', type: 'text', nullable: true })
  issuedBy?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
