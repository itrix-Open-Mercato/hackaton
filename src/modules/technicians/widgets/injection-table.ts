import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'crud-form:service_tickets.service_ticket': {
    widgetId: 'technicians.injection.TechnicianPicker',
    priority: 20,
  },
}

export default injectionTable
