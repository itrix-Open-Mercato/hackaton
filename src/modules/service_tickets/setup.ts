import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedServiceTicketExamples } from './lib/seeds'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['service_tickets.*'],
    admin: ['service_tickets.*'],
    employee: ['service_tickets.view', 'service_tickets.create', 'service_tickets.edit'],
  },
  seedExamples: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedServiceTicketExamples(ctx.em, scope)
  },
}

export default setup
