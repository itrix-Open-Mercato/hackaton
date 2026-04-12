import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

export type TechnicianReservationType = 'client_visit' | 'internal_work' | 'leave' | 'training'
export type TechnicianReservationStatus = 'auto_confirmed' | 'confirmed' | 'cancelled'
export type TechnicianReservationSourceType = 'service_ticket' | 'service_order' | 'manual'

@Entity({ tableName: 'technician_reservations' })
@Index({ name: 'technician_reservations_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'technician_reservations_window_idx', properties: ['tenantId', 'organizationId', 'startsAt', 'endsAt'] })
@Index({ name: 'technician_reservations_source_ticket_idx', properties: ['sourceTicketId'] })
@Index({ name: 'technician_reservations_source_order_idx', properties: ['sourceOrderId'] })
export class TechnicianReservation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ name: 'reservation_type', type: 'text' })
  reservationType!: TechnicianReservationType

  @Property({ type: 'text', default: 'confirmed' })
  status: TechnicianReservationStatus = 'confirmed'

  @Property({ name: 'source_type', type: 'text', default: 'manual' })
  sourceType: TechnicianReservationSourceType = 'manual'

  @Property({ name: 'source_ticket_id', type: 'uuid', nullable: true })
  sourceTicketId?: string | null

  @Property({ name: 'source_order_id', type: 'uuid', nullable: true })
  sourceOrderId?: string | null

  @Property({ name: 'starts_at', type: Date })
  startsAt!: Date

  @Property({ name: 'ends_at', type: Date })
  endsAt!: Date

  @Property({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null

  @Property({ name: 'vehicle_label', type: 'text', nullable: true })
  vehicleLabel?: string | null

  @Property({ name: 'customer_name', type: 'text', nullable: true })
  customerName?: string | null

  @Property({ type: 'text', nullable: true })
  address?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'technician_reservation_technicians' })
@Index({ name: 'technician_reservation_technicians_reservation_idx', properties: ['reservationId'] })
@Unique({ name: 'technician_reservation_technicians_unique_idx', properties: ['technicianId', 'reservationId'] })
@Index({ name: 'technician_reservation_technicians_tenant_org_technician_idx', properties: ['tenantId', 'organizationId', 'technicianId'] })
export class TechnicianReservationTechnician {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'reservation_id', type: 'uuid' })
  reservationId!: string

  @Property({ name: 'technician_id', type: 'uuid' })
  technicianId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
