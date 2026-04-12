import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export async function buildPhoneCallContext(req: Request): Promise<{
  ctx: CommandRuntimeContext
  translate: (key: string, fallback?: string) => string
}> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('phone_calls.errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return { ctx, translate }
}

export function getScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) {
    throw new CrudHttpError(400, { error: 'Tenant and organization context are required' })
  }
  return { tenantId, organizationId }
}
