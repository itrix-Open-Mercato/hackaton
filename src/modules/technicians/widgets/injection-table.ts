import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:sidebar:main': {
    widgetId: 'technicians.injection.TechnicianMenuItem',
    priority: 30,
  },
  'crud-form:service_tickets.service_ticket': {
    widgetId: 'technicians.injection.TechnicianPicker',
    priority: 20,
  },
}

export default injectionTable
