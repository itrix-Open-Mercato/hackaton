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

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: jest.fn(async () => ({ translate: (value: string) => value })),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findWithDecryption: jest.fn(async () => []),
}), { virtual: true })

jest.mock('../openapi', () => ({
  buildTechnicianScheduleCrudOpenApi: jest.fn((config: unknown) => config),
  createPagedListResponseSchema: jest.fn((schema: unknown) => schema),
}))

type CrudRouteConfig = {
  metadata: Record<string, unknown>
  list: {
    sortFieldMap: Record<string, string>
    buildFilters: (query: Record<string, string>, ctx: Record<string, unknown>) => Promise<Record<string, unknown>>
    transformItem: (item: Record<string, unknown>) => Record<string, unknown>
  }
}

function getRouteConfig(): CrudRouteConfig {
  const call = mockMakeCrudRoute.mock.calls[0]
  return call[0] as CrudRouteConfig
}

import { metadata } from '../technician-reservations/route'

describe('technician reservations route', () => {
  it('builds overlap filters for visible schedule ranges', async () => {
    const config = getRouteConfig()

    expect(metadata).toEqual({
      path: '/technician-reservations',
      GET: { requireAuth: true, requireFeatures: ['technician_schedule.view'] },
      POST: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
      PUT: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
      DELETE: { requireAuth: true, requireFeatures: ['technician_schedule.manage'] },
    })

    const filters = await config.list.buildFilters({
      startsAtFrom: '2026-04-13T00:00:00.000Z',
      startsAtTo: '2026-04-19T23:59:59.999Z',
    }, {})

    expect(filters).toEqual({
      ends_at: { $gte: '2026-04-13T00:00:00.000Z' },
      starts_at: { $lte: '2026-04-19T23:59:59.999Z' },
    })
  })

  it('normalizes postgres-style datetime strings in list responses', () => {
    const config = getRouteConfig()

    const item = config.list.transformItem({
      id: 'res-1',
      organization_id: 'org-1',
      tenant_id: 'tenant-1',
      title: 'Service ticket SRV-000008',
      reservation_type: 'client_visit',
      status: 'auto_confirmed',
      source_type: 'service_ticket',
      source_ticket_id: 'ticket-1',
      source_order_id: null,
      starts_at: '2026-04-09 07:00:00+00',
      ends_at: '2026-04-13 07:00:00+00',
      vehicle_id: null,
      vehicle_label: null,
      customer_name: null,
      address: 'Main street',
      notes: null,
      is_active: true,
      created_at: '2026-04-08 10:00:00+00',
      updated_at: '2026-04-08 11:00:00+00',
      technicians: [],
    })

    expect(item).toMatchObject({
      starts_at: '2026-04-09T07:00:00.000Z',
      ends_at: '2026-04-13T07:00:00.000Z',
      created_at: '2026-04-08T10:00:00.000Z',
      updated_at: '2026-04-08T11:00:00.000Z',
      technicians: [],
      technician_names: [],
    })
  })
})
