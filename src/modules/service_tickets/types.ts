export type ServiceTicketListItem = {
  id: string
  ticketNumber: string
  serviceType: string
  status: string
  priority: string
  description?: string | null
  visitDate?: string | null
  visitEndDate?: string | null
  address?: string | null
  customerEntityId?: string | null
  contactPersonId?: string | null
  machineAssetId?: string | null
  orderId?: string | null
  createdByUserId?: string | null
  tenantId?: string
  organizationId?: string
  createdAt?: string | null
  _service_tickets?: {
    companyName?: string | null
  }
}
