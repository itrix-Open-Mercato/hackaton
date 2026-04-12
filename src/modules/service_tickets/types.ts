import type { ServiceType, TicketStatus, TicketPriority } from './lib/constants'

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
  latitude?: number | null
  longitude?: number | null
  locationSource?: 'geocoded' | 'manual' | null
  geocodedAddress?: string | null
  customerEntityId?: string | null
  contactPersonId?: string | null
  machineInstanceId?: string | null
  orderId?: string | null
  salesChannelId?: string | null
  staffMemberIds?: string[]
  createdByUserId?: string | null
  tenantId?: string
  organizationId?: string
  createdAt?: string | null
  _service_tickets?: {
    companyName?: string | null
  }
}

/** Read-only projection used by the map endpoint. Only tickets with coordinates are included. */
export type ServiceTicketMapItem = {
  id: string
  ticketNumber: string
  status: TicketStatus
  serviceType: ServiceType
  priority: TicketPriority
  visitDate: string | null
  address: string | null
  latitude: number
  longitude: number
}

export type TicketMapSummary = {
  totalFiltered: number
  mapped: number
  unmapped: number
  cappedAt: number
  truncated: boolean
}

export type TicketMapResponse = {
  items: ServiceTicketMapItem[]
  summary: TicketMapSummary
}
