/**
 * @jest-environment node
 */
const mockMakeCrudRoute = jest.fn((config: unknown) => ({
  metadata: (config as { metadata: unknown }).metadata,
  GET: jest.fn(),
  POST: jest.fn(),
  PUT: jest.fn(),
  DELETE: jest.fn(),
}))

jest.mock('@open-mercato/shared/lib/crud/factory', () => ({
  makeCrudRoute: (config: unknown) => mockMakeCrudRoute(config),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/db/escapeLikePattern', () => ({
  escapeLikePattern: (value: string) => value.replaceAll('%', '\\%').replaceAll('_', '\\_'),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/api/scoped', () => ({
  parseScopedCommandInput: jest.fn(),
  resolveCrudRecordId: jest.fn(),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: jest.fn(async () => ({ translate: (key: string) => key })),
}), { virtual: true })

jest.mock('../../commands/machine-instances', () => ({}))

import { metadata, openApi } from '../machines/route'

type CrudRouteConfig = {
  metadata: Record<string, unknown>
  list: {
    buildFilters: (query: Record<string, string>) => Promise<Record<string, unknown>>
  }
}

function getRouteConfig(): CrudRouteConfig {
  const call = mockMakeCrudRoute.mock.calls[0]
  return call[0] as CrudRouteConfig
}

describe('machine instances route', () => {
  it('registers CRUD metadata for machine instances', () => {
    expect(metadata).toEqual({
      GET: { requireAuth: true, requireFeatures: ['machine_instances.view'] },
      POST: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
      PUT: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
      DELETE: { requireAuth: true, requireFeatures: ['machine_instances.manage'] },
    })
    expect(openApi).toBeDefined()
  })

  it('searches across machine identity and location fields for autocomplete', async () => {
    const config = getRouteConfig()

    const filters = await config.list.buildFilters({
      ids: 'machine-1,machine-2',
      search: 'hall',
      customerCompanyId: 'company-1',
      warrantyStatus: 'active',
      isActive: 'true',
    })

    expect(filters).toEqual({
      id: { $in: ['machine-1', 'machine-2'] },
      $or: [
        { instance_code: { $ilike: '%hall%' } },
        { serial_number: { $ilike: '%hall%' } },
        { site_name: { $ilike: '%hall%' } },
        { location_label: { $ilike: '%hall%' } },
        { contact_name: { $ilike: '%hall%' } },
      ],
      customer_company_id: 'company-1',
      warranty_status: 'active',
      is_active: true,
    })
  })
})
