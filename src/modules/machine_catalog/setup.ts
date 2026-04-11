import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedMachineCatalogExamples } from '../../lib/machines/exampleSeeds'

export const setup: ModuleSetupConfig = {
  seedExamples: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedMachineCatalogExamples(ctx.em, scope)
  },

  defaultRoleFeatures: {
    admin: ['machine_catalog.view', 'machine_catalog.manage'],
    employee: ['machine_catalog.view'],
  },
}

export default setup
