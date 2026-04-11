import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CredentialsService } from '@open-mercato/core/modules/integrations/lib/credentials-service'
import { tillioSettingsSchema } from '../../../data/validators'
import { TILLIO_DEFAULT_API_BASE_URL, TILLIO_INTEGRATION_ID } from '../../../lib/constants'
import { createTillioConfig, validateTillioConfig, type TillioCredentials } from '../../../lib/tillioClient'
import type { TillioSettingsView } from '../../../types'
import { buildPhoneCallContext, getScope } from '../../../lib/apiContext'
import { phoneCallsTag, tillioSettingsViewSchema } from '../../../lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['integrations.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['integrations.manage'] },
}

function viewFromCredentials(raw: Record<string, unknown> | null): TillioSettingsView {
  const read = (key: string, fallback = '') => (typeof raw?.[key] === 'string' ? String(raw[key]) : fallback)
  return {
    configured: Boolean(raw),
    apiBaseUrl: read('apiBaseUrl', TILLIO_DEFAULT_API_BASE_URL),
    plugin: read('plugin', 'Ringostat'),
    system: read('system'),
    tenant: read('tenant'),
    tenantDomain: read('tenantDomain'),
    hasApiKey: typeof raw?.apiKey === 'string' && raw.apiKey.length > 0,
    hasProviderKey: typeof raw?.providerKey === 'string' && raw.providerKey.length > 0,
    hasToken: typeof raw?.token === 'string' && raw.token.length > 0,
  }
}

function credentialsFromInput(
  input: z.infer<typeof tillioSettingsSchema>,
  current: Record<string, unknown> | null,
): TillioCredentials {
  const currentProviderKey = typeof current?.providerKey === 'string' ? current.providerKey : ''
  const currentApiKey = typeof current?.apiKey === 'string' ? current.apiKey : ''
  const currentToken = typeof current?.token === 'string' ? current.token : ''
  const apiKey = input.api_key || currentApiKey || currentProviderKey
  if (!apiKey) throw new CrudHttpError(400, { error: 'Tillio API key is required' })
  const providerKey = input.provider_key || currentProviderKey
  if (!providerKey) throw new CrudHttpError(400, { error: 'Ringostat auth key is required' })

  return {
    apiBaseUrl: input.api_base_url,
    plugin: input.plugin,
    system: input.system,
    tenant: input.tenant,
    tenantDomain: input.tenant_domain,
    apiKey,
    providerKey,
    token: (input.token ?? currentToken) || null,
  }
}

export async function GET(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const credentialsService = ctx.container.resolve('integrationCredentialsService') as CredentialsService
    const raw = await credentialsService.resolve(TILLIO_INTEGRATION_ID, getScope(ctx))
    return NextResponse.json(viewFromCredentials(raw))
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Failed to load Tillio settings' }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  try {
    const { ctx } = await buildPhoneCallContext(req)
    const scope = getScope(ctx)
    const body = await req.json().catch(() => ({}))
    const input = tillioSettingsSchema.parse(body)
    const credentialsService = ctx.container.resolve('integrationCredentialsService') as CredentialsService
    const currentCredentials = await credentialsService.resolve(TILLIO_INTEGRATION_ID, scope)
    const credentials = credentialsFromInput(input, currentCredentials)

    const valid = await validateTillioConfig(credentials)
    if (!valid) throw new CrudHttpError(400, { error: 'Tillio rejected the Ringostat configuration' })

    const token = credentials.token || await createTillioConfig(credentials)
    await credentialsService.save(
      TILLIO_INTEGRATION_ID,
      {
        apiBaseUrl: credentials.apiBaseUrl,
        plugin: credentials.plugin,
        system: credentials.system,
        tenant: credentials.tenant,
        tenantDomain: credentials.tenantDomain,
        apiKey: credentials.apiKey,
        providerKey: credentials.providerKey,
        token,
      },
      scope,
    )

    return NextResponse.json({ ok: true, ...viewFromCredentials({ ...credentials, token }) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    const message = err instanceof Error && err.message ? err.message : 'Failed to save Tillio settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: phoneCallsTag,
  summary: 'Manage Tillio settings',
  methods: {
    GET: {
      summary: 'Get masked Tillio settings',
      responses: [
        { status: 200, description: 'Current settings', schema: tillioSettingsViewSchema },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
    PUT: {
      summary: 'Validate and save Tillio settings',
      requestBody: { contentType: 'application/json', schema: tillioSettingsSchema },
      responses: [
        { status: 200, description: 'Settings saved', schema: tillioSettingsViewSchema.extend({ ok: z.literal(true) }) },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
