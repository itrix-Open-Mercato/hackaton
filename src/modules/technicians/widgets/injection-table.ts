import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = [
  { widgetId: 'TechnicianMenuItem', spots: ['menu:sidebar:main'] },
  { widgetId: 'TechnicianPicker', spots: ['crud-form:service_tickets:service_ticket'] },
]

export default injectionTable
