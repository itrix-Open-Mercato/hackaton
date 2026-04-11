import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'machine_instances.machine.created', label: 'Machine Instance Created', entity: 'machine', category: 'crud' },
  { id: 'machine_instances.machine.updated', label: 'Machine Instance Updated', entity: 'machine', category: 'crud' },
  { id: 'machine_instances.machine.deleted', label: 'Machine Instance Deleted', entity: 'machine', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'machine_instances',
  events,
})

export const emitMachineInstanceEvent = eventsConfig.emit
export type MachineInstanceEventId = typeof events[number]['id']
export default eventsConfig
