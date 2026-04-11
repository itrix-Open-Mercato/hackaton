import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'machine_catalog.profile.created', label: 'Machine Profile Created', entity: 'profile', category: 'crud' },
  { id: 'machine_catalog.profile.updated', label: 'Machine Profile Updated', entity: 'profile', category: 'crud' },
  { id: 'machine_catalog.profile.deleted', label: 'Machine Profile Deleted', entity: 'profile', category: 'crud' },
  { id: 'machine_catalog.part_template.created', label: 'Part Template Created', entity: 'part_template', category: 'crud' },
  { id: 'machine_catalog.part_template.deleted', label: 'Part Template Deleted', entity: 'part_template', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'machine_catalog',
  events,
})

export const emitMachineCatalogEvent = eventsConfig.emit
export type MachineCatalogEventId = typeof events[number]['id']
export default eventsConfig
