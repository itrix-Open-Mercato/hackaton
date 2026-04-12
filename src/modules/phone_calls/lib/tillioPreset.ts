import type { IntegrationScope } from '@open-mercato/shared/modules/integrations/types'
import type { CredentialsService } from '@open-mercato/core/modules/integrations/lib/credentials-service'
import { TILLIO_DEFAULT_API_BASE_URL, TILLIO_INTEGRATION_ID } from './constants'

type TillioDefaultPreset = {
  apiBaseUrl: string
  plugin: string
  system: string
  tenant: string
  tenantDomain: string
  apiKey: string
  providerKey: string
  token: string | null
  projectId: string
}

export type ApplyTillioDefaultPresetResult =
  | { status: 'skipped'; reason: string }
  | { status: 'configured' }

function readEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

export function readTillioDefaultPreset(): TillioDefaultPreset {
  return {
    apiBaseUrl: readEnv(['OM_PHONE_CALLS_TILLIO_API_BASE_URL', 'TILLIO_API_URL']) ?? 'https://tillio-voip-copy-880581879868.europe-west1.run.app',
    plugin: readEnv(['OM_PHONE_CALLS_TILLIO_PLUGIN', 'TILLIO_PLUGIN']) ?? 'Ringostat',
    system: readEnv(['OM_PHONE_CALLS_TILLIO_SYSTEM', 'TILLIO_API_SYSTEM']) ?? 'itrix.dev',
    tenant: readEnv(['OM_PHONE_CALLS_TILLIO_TENANT', 'TILLIO_API_TENANT']) ?? 'itrix-tillio-app-fckgwrhqq2',
    tenantDomain: readEnv(['OM_PHONE_CALLS_TILLIO_TENANT_DOMAIN', 'TILLIO_API_TENANT_DOMAIN']) ?? 'itrix.dev',
    apiKey: readEnv(['OM_PHONE_CALLS_TILLIO_API_KEY', 'TILLIO_API_KEY']) ?? '99baee504a1fe91a07bc66b6900bd39874191889',
    providerKey: readEnv(['OM_PHONE_CALLS_RINGOSTAT_AUTH_KEY', 'RINGOSTAT_AUTH_KEY']) ?? 'm1gNmpwu8k2Si1JR1Q2kd1HLbrKw5yqw',
    token: readEnv(['OM_PHONE_CALLS_TILLIO_TOKEN', 'TILLIO_API_TOKEN']) ?? null,
    projectId: readEnv(['OM_PHONE_CALLS_RINGOSTAT_PROJECT_ID', 'RINGOSTAT_PROJECT_ID']) ?? '135049',
  }
}

export async function applyTillioDefaultPreset(params: {
  credentialsService: CredentialsService
  scope: IntegrationScope
  force?: boolean
}): Promise<ApplyTillioDefaultPresetResult> {
  const existing = await params.credentialsService.resolve(TILLIO_INTEGRATION_ID, params.scope)
  const hasCompleteExistingCredentials =
    typeof existing?.apiKey === 'string' && existing.apiKey.length > 0 &&
    typeof existing?.providerKey === 'string' && existing.providerKey.length > 0 &&
    typeof existing?.system === 'string' && existing.system.length > 0 &&
    typeof existing?.tenant === 'string' && existing.tenant.length > 0 &&
    typeof existing?.tenantDomain === 'string' && existing.tenantDomain.length > 0
  if (hasCompleteExistingCredentials && !params.force) {
    return { status: 'skipped', reason: 'Tillio credentials already exist.' }
  }

  const preset = readTillioDefaultPreset()
  await params.credentialsService.save(
    TILLIO_INTEGRATION_ID,
    {
      ...(existing ?? {}),
      apiBaseUrl: preset.apiBaseUrl || TILLIO_DEFAULT_API_BASE_URL,
      plugin: preset.plugin,
      system: preset.system,
      tenant: preset.tenant,
      tenantDomain: preset.tenantDomain,
      apiKey: preset.apiKey,
      providerKey: preset.providerKey,
      token: preset.token,
      projectId: preset.projectId,
    },
    params.scope,
  )

  return { status: 'configured' }
}
