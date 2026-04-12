import './commands/technicians'
import './commands/skills'
import './commands/certifications'
import './commands/availability'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'technicians',
  title: 'Technicians',
  version: '0.1.0',
  description: 'Field technician profiles with skills, certifications, and service ticket integration.',
  author: 'Open Mercato Team',
  license: 'MIT',
}

export { features } from './acl'
