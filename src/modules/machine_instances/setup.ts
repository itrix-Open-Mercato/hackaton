import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedMachineInstanceExamples } from '../../lib/machines/exampleSeeds'

export const setup: ModuleSetupConfig = {
  seedExamples: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedMachineInstanceExamples(ctx.em, scope)
  },

  defaultRoleFeatures: {
    admin: ['machine_instances.view', 'machine_instances.manage'],
    employee: ['machine_instances.view'],
  },
}

export default setup
