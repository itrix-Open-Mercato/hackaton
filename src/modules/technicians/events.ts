import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'technicians.technician.created', label: 'Technician Created', entity: 'technician', category: 'crud', clientBroadcast: true },
  { id: 'technicians.technician.updated', label: 'Technician Updated', entity: 'technician', category: 'crud', clientBroadcast: true },
  { id: 'technicians.technician.deleted', label: 'Technician Deleted', entity: 'technician', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'technicians',
  events,
})

export const emitTechnicianEvent = eventsConfig.emit

export type TechnicianEventId = typeof events[number]['id']

export default eventsConfig
