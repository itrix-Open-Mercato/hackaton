import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['service_tickets.*'],
    admin: ['service_tickets.*'],
    employee: ['service_tickets.view', 'service_tickets.create', 'service_tickets.edit'],
  },
}

export default setup
