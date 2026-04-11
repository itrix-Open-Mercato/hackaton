import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  ManyToOne,
  OptionalProps,
} from '@mikro-orm/core'
import type { ServiceType, TicketStatus, TicketPriority } from '../lib/constants'

@Entity({ tableName: 'service_tickets' })
@Index({ name: 'st_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'st_status_tenant_org_idx', properties: ['status', 'tenantId', 'organizationId'] })
@Index({ name: 'st_customer_idx', properties: ['customerEntityId'] })
@Index({ name: 'st_contact_person_idx', properties: ['contactPersonId'] })
@Index({ name: 'st_machine_idx', properties: ['machineAssetId'] })
@Unique({ name: 'st_ticket_number_unique', properties: ['ticketNumber', 'tenantId', 'organizationId'] })
export class ServiceTicket {
  [OptionalProps]?: 'status' | 'priority' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'ticket_number', type: 'text' })
  ticketNumber!: string

  @Property({ name: 'service_type', type: 'text' })
  serviceType!: ServiceType

  @Property({ name: 'status', type: 'text', default: 'new' })
  status: TicketStatus = 'new'

  @Property({ name: 'priority', type: 'text', default: 'normal' })
  priority: TicketPriority = 'normal'

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'visit_date', type: Date, nullable: true })
  visitDate?: Date | null

  @Property({ name: 'visit_end_date', type: Date, nullable: true })
  visitEndDate?: Date | null

  @Property({ type: 'text', nullable: true })
  address?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'contact_person_id', type: 'uuid', nullable: true })
  contactPersonId?: string | null

  @Property({ name: 'machine_asset_id', type: 'uuid', nullable: true })
  machineAssetId?: string | null

  @Property({ name: 'order_id', type: 'uuid', nullable: true })
  orderId?: string | null

  @Property({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'service_ticket_assignments' })
@Unique({ name: 'sta_ticket_staff_unique', properties: ['ticket', 'staffMemberId'] })
@Index({ name: 'sta_staff_idx', properties: ['staffMemberId'] })
export class ServiceTicketAssignment {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceTicket, { fieldName: 'ticket_id' })
  ticket!: ServiceTicket

  @Property({ name: 'staff_member_id', type: 'uuid' })
  staffMemberId!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'service_ticket_parts' })
export class ServiceTicketPart {
  [OptionalProps]?: 'quantity' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceTicket, { fieldName: 'ticket_id' })
  ticket!: ServiceTicket

  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  @Property({ type: 'integer', default: 1 })
  quantity: number = 1

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'service_ticket_date_changes' })
export class ServiceTicketDateChange {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceTicket, { fieldName: 'ticket_id' })
  ticket!: ServiceTicket

  @Property({ name: 'old_date', type: Date, nullable: true })
  oldDate?: Date | null

  @Property({ name: 'new_date', type: Date, nullable: true })
  newDate?: Date | null

  @Property({ type: 'text', nullable: true })
  reason?: string | null

  @Property({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
