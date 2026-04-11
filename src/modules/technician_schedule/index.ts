import './commands/reservations'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'technician_schedule',
  title: 'Technician Schedule',
  version: '1.0.0',
  description: 'Calendar reservations and availability scheduling for field technicians.',
  author: 'App',
  license: 'Proprietary',
}

export { features } from './acl'
