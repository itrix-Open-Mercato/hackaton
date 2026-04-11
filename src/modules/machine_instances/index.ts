import './commands/machine-instances'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'machine_instances',
  title: 'Machine Instances',
  version: '0.1.0',
  description: 'Installed machine instance register (egzemplarze maszyn u klientów).',
}

export { features } from './acl'
