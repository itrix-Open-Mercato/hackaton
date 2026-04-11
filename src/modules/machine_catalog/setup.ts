import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['machine_catalog.view', 'machine_catalog.manage'],
    employee: ['machine_catalog.view'],
  },
}

export default setup
