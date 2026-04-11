import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['machine_instances.view', 'machine_instances.manage'],
    employee: ['machine_instances.view'],
  },
}

export default setup
