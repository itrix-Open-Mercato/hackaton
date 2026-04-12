import './commands/calls'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'phone_calls',
  title: 'Phone Calls',
  version: '0.1.0',
  description: 'VOIP call intake and service-ticket handoff.',
  author: 'Open Mercato Team',
  license: 'MIT',
  requires: ['integrations', 'service_tickets'],
}
