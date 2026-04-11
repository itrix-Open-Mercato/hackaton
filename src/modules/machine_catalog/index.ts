import './commands/machine-catalog'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'machine_catalog',
  title: 'Machine Catalog',
  version: '0.1.0',
  description: 'Machine profiles and service kit templates for catalog products.',
}

export { features } from './acl'
