import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['field_technicians.*'],
    employee: ['field_technicians.view'],
  },
}

export default setup
