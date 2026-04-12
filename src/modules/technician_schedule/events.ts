import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'technician_schedule.reservation.created', label: 'Reservation Created', entity: 'reservation', category: 'crud' },
  { id: 'technician_schedule.reservation.updated', label: 'Reservation Updated', entity: 'reservation', category: 'crud' },
  { id: 'technician_schedule.reservation.cancelled', label: 'Reservation Cancelled', entity: 'reservation', category: 'crud' },
  { id: 'technician_schedule.reservation.conflict_detected', label: 'Reservation Conflict Detected', entity: 'reservation', category: 'lifecycle' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'technician_schedule',
  events,
})

export const emitTechnicianScheduleEvent = eventsConfig.emit

export type TechnicianScheduleEventId = typeof events[number]['id']

export default eventsConfig
