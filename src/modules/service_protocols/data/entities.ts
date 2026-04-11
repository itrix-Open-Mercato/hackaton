import {
  Entity,
  PrimaryKey,
  Property,
  Index,
  Unique,
  ManyToOne,
  OptionalProps,
} from '@mikro-orm/core'

export type ProtocolStatus = 'draft' | 'in_review' | 'approved' | 'closed' | 'cancelled'
export type ProtocolType = 'standard' | 'valuation_only'
export type PartLineStatus = 'proposed' | 'confirmed' | 'added' | 'removed'
export type HistoryEventType =
  | 'created_from_ticket'
  | 'status_change'
  | 'field_edit'
  | 'technician_added'
  | 'technician_removed'
  | 'part_changed'
  | 'rejected'
  | 'approved'
  | 'closed'
  | 'unlocked'
  | 'cancelled'

@Entity({ tableName: 'service_protocols' })
@Index({ name: 'sp_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'sp_ticket_tenant_org_idx', properties: ['serviceTicketId', 'tenantId', 'organizationId'] })
@Index({ name: 'sp_status_tenant_org_idx', properties: ['status', 'tenantId', 'organizationId'] })
@Unique({ name: 'sp_protocol_number_unique', properties: ['protocolNumber', 'tenantId', 'organizationId'] })
export class ServiceProtocol {
  [OptionalProps]?: 'status' | 'type' | 'isActive' | 'completedTicketOnClose' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'service_ticket_id', type: 'uuid' })
  serviceTicketId!: string

  @Property({ name: 'protocol_number', type: 'text' })
  protocolNumber!: string

  @Property({ name: 'status', type: 'text', default: 'draft' })
  status: ProtocolStatus = 'draft'

  @Property({ name: 'type', type: 'text', default: 'standard' })
  type: ProtocolType = 'standard'

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'contact_person_id', type: 'uuid', nullable: true })
  contactPersonId?: string | null

  @Property({ name: 'machine_asset_id', type: 'uuid', nullable: true })
  machineAssetId?: string | null

  @Property({ name: 'service_address_snapshot', type: 'jsonb', nullable: true })
  serviceAddressSnapshot?: Record<string, unknown> | null

  @Property({ name: 'ticket_description_snapshot', type: 'text', nullable: true })
  ticketDescriptionSnapshot?: string | null

  @Property({ name: 'planned_visit_date_snapshot', type: Date, nullable: true })
  plannedVisitDateSnapshot?: Date | null

  @Property({ name: 'planned_visit_end_date_snapshot', type: Date, nullable: true })
  plannedVisitEndDateSnapshot?: Date | null

  @Property({ name: 'work_description', type: 'text', nullable: true })
  workDescription?: string | null

  @Property({ name: 'technician_notes', type: 'text', nullable: true })
  technicianNotes?: string | null

  @Property({ name: 'customer_notes', type: 'text', nullable: true })
  customerNotes?: string | null

  @Property({ name: 'prepared_cost_summary', type: 'jsonb', nullable: true })
  preparedCostSummary?: Record<string, unknown>[] | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'closed_at', type: Date, nullable: true })
  closedAt?: Date | null

  @Property({ name: 'closed_by_user_id', type: 'uuid', nullable: true })
  closedByUserId?: string | null

  @Property({ name: 'completed_ticket_on_close', type: 'boolean', default: false })
  completedTicketOnClose: boolean = false

  @Property({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'service_protocol_technicians' })
@Unique({ name: 'spt_protocol_staff_unique', properties: ['protocol', 'staffMemberId'] })
export class ServiceProtocolTechnician {
  [OptionalProps]?: 'hoursWorked' | 'isBillable' | 'kmDriven' | 'kmIsBillable' | 'delegationDays' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceProtocol, { fieldName: 'protocol_id' })
  protocol!: ServiceProtocol

  @Property({ name: 'staff_member_id', type: 'uuid' })
  staffMemberId!: string

  @Property({ name: 'date_from', type: 'date', nullable: true })
  dateFrom?: string | null

  @Property({ name: 'date_to', type: 'date', nullable: true })
  dateTo?: string | null

  @Property({ name: 'hours_worked', type: 'decimal', default: 0 })
  hoursWorked: number = 0

  @Property({ name: 'hourly_rate_snapshot', type: 'decimal', nullable: true })
  hourlyRateSnapshot?: number | null

  @Property({ name: 'is_billable', type: 'boolean', default: false })
  isBillable: boolean = false

  @Property({ name: 'km_driven', type: 'decimal', default: 0 })
  kmDriven: number = 0

  @Property({ name: 'km_rate_snapshot', type: 'decimal', nullable: true })
  kmRateSnapshot?: number | null

  @Property({ name: 'km_is_billable', type: 'boolean', default: false })
  kmIsBillable: boolean = false

  @Property({ name: 'delegation_days', type: 'integer', default: 0 })
  delegationDays: number = 0

  @Property({ name: 'delegation_country', type: 'text', nullable: true })
  delegationCountry?: string | null

  @Property({ name: 'diet_rate_snapshot', type: 'decimal', nullable: true })
  dietRateSnapshot?: number | null

  @Property({ name: 'hotel_invoice_ref', type: 'text', nullable: true })
  hotelInvoiceRef?: string | null

  @Property({ name: 'hotel_amount', type: 'decimal', nullable: true })
  hotelAmount?: number | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'service_protocol_parts' })
export class ServiceProtocolPart {
  [OptionalProps]?: 'quantityProposed' | 'quantityUsed' | 'isBillable' | 'lineStatus' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceProtocol, { fieldName: 'protocol_id' })
  protocol!: ServiceProtocol

  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

  @Property({ name: 'name_snapshot', type: 'text' })
  nameSnapshot!: string

  @Property({ name: 'part_code_snapshot', type: 'text', nullable: true })
  partCodeSnapshot?: string | null

  @Property({ name: 'quantity_proposed', type: 'decimal', default: 0 })
  quantityProposed: number = 0

  @Property({ name: 'quantity_used', type: 'decimal', default: 0 })
  quantityUsed: number = 0

  @Property({ type: 'text', nullable: true })
  unit?: string | null

  @Property({ name: 'unit_price_snapshot', type: 'decimal', nullable: true })
  unitPriceSnapshot?: number | null

  @Property({ name: 'is_billable', type: 'boolean', default: false })
  isBillable: boolean = false

  @Property({ name: 'line_status', type: 'text', default: 'proposed' })
  lineStatus: PartLineStatus = 'proposed'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'service_protocol_history' })
export class ServiceProtocolHistory {
  [OptionalProps]?: 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceProtocol, { fieldName: 'protocol_id' })
  protocol!: ServiceProtocol

  @Property({ name: 'event_type', type: 'text' })
  eventType!: HistoryEventType

  @Property({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue?: Record<string, unknown> | null

  @Property({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue?: Record<string, unknown> | null

  @Property({ name: 'performed_by_user_id', type: 'uuid', nullable: true })
  performedByUserId?: string | null

  @Property({ name: 'performed_at', type: Date })
  performedAt!: Date

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
