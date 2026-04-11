import './commands/tickets'
import './commands/parts'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'service_tickets',
  title: 'Service Tickets',
  version: '0.1.0',
  description: 'Field-service work-order management for commissioning, maintenance and warranty.',
  author: 'Open Mercato Team',
  license: 'MIT',
}
