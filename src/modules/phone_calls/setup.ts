import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { CredentialsService } from '@open-mercato/core/modules/integrations/lib/credentials-service'
import { applyTillioDefaultPreset } from './lib/tillioPreset'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['phone_calls.*'],
    admin: ['phone_calls.*'],
    employee: ['phone_calls.view', 'phone_calls.summary.view', 'phone_calls.service_ticket.link', 'phone_calls.service_ticket.create'],
  },

  async seedDefaults({ container, tenantId, organizationId }) {
    const credentialsService = container.resolve('integrationCredentialsService') as CredentialsService
    const result = await applyTillioDefaultPreset({
      credentialsService,
      scope: { tenantId, organizationId },
    })
    if (result.status === 'configured') {
      console.log('[phone_calls] Seeded default Tillio/Ringostat credentials.')
    }
  },
}

export default setup
