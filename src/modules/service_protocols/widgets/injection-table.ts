import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  // Header slot is rendered outside the <form> (see CrudForm FormHeader / extraActions).
  // Avoids nested-dialog / submit / focus conflicts with the ticket CrudForm body.
  'crud-form:service_tickets.service_ticket:header': {
    widgetId: 'service_protocols.injection.ServiceTicketProtocolAction',
    priority: 50,
  },
}

export default injectionTable
