import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'inbox_ops.proposal.action:buttons': {
    widgetId: 'service_tickets.injection.open-ticket-form',
    priority: 50,
  },
}

export default injectionTable
