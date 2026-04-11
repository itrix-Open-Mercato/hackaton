import './commands/index'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'field_technicians',
  title: 'Technicians',
  version: '1.0.0',
  description: 'Service technician profiles, certifications, skills and availability.',
  author: 'App',
  license: 'Proprietary',
}

export { features } from './acl'
