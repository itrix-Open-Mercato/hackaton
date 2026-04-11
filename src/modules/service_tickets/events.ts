import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'service_tickets.ticket.created', label: 'Service Ticket Created', entity: 'ticket', category: 'crud', clientBroadcast: true },
  { id: 'service_tickets.ticket.updated', label: 'Service Ticket Updated', entity: 'ticket', category: 'crud', clientBroadcast: true },
  { id: 'service_tickets.ticket.deleted', label: 'Service Ticket Deleted', entity: 'ticket', category: 'crud', clientBroadcast: true },
  { id: 'service_tickets.ticket.status_changed', label: 'Service Ticket Status Changed', entity: 'ticket', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'service_tickets',
  events,
})

export const emitServiceTicketEvent = eventsConfig.emit

export type ServiceTicketEventId = typeof events[number]['id']

export default eventsConfig
