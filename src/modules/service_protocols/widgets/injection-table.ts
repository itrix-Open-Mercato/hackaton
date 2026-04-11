import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'crud-form:service_tickets.service_ticket': {
    widgetId: 'service_protocols.injection.ServiceTicketProtocolAction',
    priority: 50,
  },
}

export default injectionTable
