import './commands/protocols'
import './commands/technicians'
import './commands/parts'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'service_protocols',
  title: 'Service Protocols',
  version: '0.1.0',
  description: 'Work report and protocol workflow for completed service tickets.',
  author: 'Open Mercato Team',
  license: 'MIT',
}
