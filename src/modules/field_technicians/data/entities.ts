import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core'

export type FieldTechnicianLocationStatus = 'in_office' | 'on_trip' | 'at_client' | 'unavailable'

@Entity({ tableName: 'field_technicians' })
@Index({ name: 'field_technicians_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'field_technicians_is_active_idx', properties: ['tenantId', 'organizationId', 'isActive'] })
export class FieldTechnician {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'display_name', type: 'text' })
  displayName!: string

  @Property({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string | null

  @Property({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string | null

  @Property({ type: 'text', nullable: true })
  email?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ name: 'location_status', type: 'text', default: 'in_office' })
  locationStatus: FieldTechnicianLocationStatus = 'in_office'

  @Property({ type: 'jsonb', default: [] })
  skills: string[] = []

  @Property({ type: 'jsonb', default: [] })
  languages: string[] = []

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'staff_member_id', type: 'uuid', nullable: true })
  staffMemberId?: string | null

  @Property({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null

  @Property({ name: 'vehicle_label', type: 'text', nullable: true })
  vehicleLabel?: string | null

  @Property({ name: 'current_order_id', type: 'uuid', nullable: true })
  currentOrderId?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'field_technician_certifications' })
@Index({ name: 'field_technician_certs_technician_idx', properties: ['technicianId'] })
@Index({ name: 'field_technician_certs_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'field_technician_certs_expires_idx', properties: ['tenantId', 'organizationId', 'expiresAt'] })
export class FieldTechnicianCertification {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'technician_id', type: 'uuid' })
  technicianId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'cert_type', type: 'text', nullable: true })
  certType?: string | null

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

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
