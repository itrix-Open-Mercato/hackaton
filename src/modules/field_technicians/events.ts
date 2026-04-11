import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'field_technicians.field_technician.created', label: 'Technician Created', entity: 'field_technician', category: 'crud' },
  { id: 'field_technicians.field_technician.updated', label: 'Technician Updated', entity: 'field_technician', category: 'crud' },
  { id: 'field_technicians.field_technician.deleted', label: 'Technician Deleted', entity: 'field_technician', category: 'crud' },
  { id: 'field_technicians.certification.created', label: 'Certification Added', entity: 'certification', category: 'crud' },
  { id: 'field_technicians.certification.updated', label: 'Certification Updated', entity: 'certification', category: 'crud' },
  { id: 'field_technicians.certification.deleted', label: 'Certification Removed', entity: 'certification', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'field_technicians',
  events,
})

export const emitFieldTechniciansEvent = eventsConfig.emit

export type FieldTechniciansEventId = typeof events[number]['id']

export default eventsConfig
