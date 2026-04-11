import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'service_protocols.protocol.created', label: 'Service Protocol Created', entity: 'protocol', category: 'crud', clientBroadcast: true },
  { id: 'service_protocols.protocol.updated', label: 'Service Protocol Updated', entity: 'protocol', category: 'crud', clientBroadcast: true },
  { id: 'service_protocols.protocol.submitted', label: 'Service Protocol Submitted', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.protocol.rejected', label: 'Service Protocol Rejected', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.protocol.approved', label: 'Service Protocol Approved', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.protocol.closed', label: 'Service Protocol Closed', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.protocol.cancelled', label: 'Service Protocol Cancelled', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.protocol.unlocked', label: 'Service Protocol Unlocked', entity: 'protocol', category: 'lifecycle', clientBroadcast: true },
  { id: 'service_protocols.technician.updated', label: 'Protocol Technician Updated', entity: 'technician', category: 'crud', clientBroadcast: false },
  { id: 'service_protocols.part.updated', label: 'Protocol Part Updated', entity: 'part', category: 'crud', clientBroadcast: false },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'service_protocols',
  events,
})

export const emitProtocolEvent = eventsConfig.emit

export type ServiceProtocolEventId = typeof events[number]['id']

export default eventsConfig
