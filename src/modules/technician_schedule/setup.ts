import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['technician_schedule.*'],
    employee: ['technician_schedule.view'],
  },
}

export default setup
