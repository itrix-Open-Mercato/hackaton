import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['service_protocols.*'],
    admin: ['service_protocols.*'],
    employee: ['service_protocols.view', 'service_protocols.view_own', 'service_protocols.create', 'service_protocols.edit'],
  },
}

export default setup
