import { z } from 'zod'
import { serviceTypeSchema, ticketStatusSchema, ticketPrioritySchema } from '../data/validators'

export const ENTITY_TYPE = 'service_tickets:service_ticket'

// Depot / office origin used for route directions and transport cost estimates.
// Update these coordinates to match the actual company location.
export const ORIGIN_POINT: { lat: number; lng: number } = { lat: 52.46628148098175, lng: 16.989738842580948 }

// Transport cost rate in PLN per kilometre of driving distance.
export const TRANSPORT_RATE_PLN_PER_KM = 1.5

export function drivingCostPln(distanceMeters: number, ratePerKm: number): number {
  return (distanceMeters / 1000) * ratePerKm
}

export type ServiceType = z.infer<typeof serviceTypeSchema>
export type TicketStatus = z.infer<typeof ticketStatusSchema>
export type TicketPriority = z.infer<typeof ticketPrioritySchema>

export const SERVICE_TYPE_VALUES = serviceTypeSchema.options
export const STATUS_VALUES = ticketStatusSchema.options
export const PRIORITY_VALUES = ticketPrioritySchema.options

export const SERVICE_TYPE_I18N_KEYS: Record<ServiceType, string> = {
  commissioning: 'service_tickets.enum.serviceType.commissioning',
  regular: 'service_tickets.enum.serviceType.regular',
  warranty_claim: 'service_tickets.enum.serviceType.warranty_claim',
  maintenance: 'service_tickets.enum.serviceType.maintenance',
}

export const STATUS_I18N_KEYS: Record<TicketStatus, string> = {
  new: 'service_tickets.enum.status.new',
  scheduled: 'service_tickets.enum.status.scheduled',
  in_progress: 'service_tickets.enum.status.in_progress',
  completed: 'service_tickets.enum.status.completed',
  on_hold: 'service_tickets.enum.status.on_hold',
  cancelled: 'service_tickets.enum.status.cancelled',
}

export const PRIORITY_I18N_KEYS: Record<TicketPriority, string> = {
  normal: 'service_tickets.enum.priority.normal',
  urgent: 'service_tickets.enum.priority.urgent',
  critical: 'service_tickets.enum.priority.critical',
}
