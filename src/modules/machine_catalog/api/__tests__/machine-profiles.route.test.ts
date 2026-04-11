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

jest.mock('../../commands/machine-catalog', () => ({}))

import { metadata, openApi } from '../machine-profiles/route'

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

describe('machine catalog profiles route', () => {
  it('registers CRUD metadata for machine catalog', () => {
    expect(metadata).toEqual({
      GET: { requireAuth: true, requireFeatures: ['machine_catalog.view'] },
      POST: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
      PUT: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
      DELETE: { requireAuth: true, requireFeatures: ['machine_catalog.manage'] },
    })
    expect(openApi).toBeDefined()
  })

  it('filters by ids, search, catalogProductId, and isActive', async () => {
    const config = getRouteConfig()

    const filters = await config.list.buildFilters({
      ids: 'profile-1,profile-2',
      search: 'CNC',
      catalogProductId: 'product-uuid',
      isActive: 'true',
    })

    expect(filters).toEqual({
      id: { $in: ['profile-1', 'profile-2'] },
      $or: [
        { machine_family: { $ilike: '%CNC%' } },
        { model_code: { $ilike: '%CNC%' } },
      ],
      catalog_product_id: 'product-uuid',
      is_active: true,
    })
  })

  it('returns empty filters when no query params provided', async () => {
    const config = getRouteConfig()

    const filters = await config.list.buildFilters({})
    expect(filters).toEqual({})
  })
})
