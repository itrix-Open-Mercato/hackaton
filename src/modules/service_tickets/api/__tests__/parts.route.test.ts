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
}))

jest.mock('../openapi', () => ({
  createServiceTicketCrudOpenApi: jest.fn((config: unknown) => config),
  createServiceTicketPagedListResponseSchema: jest.fn((schema: unknown) => schema),
  serviceTicketCreatedSchema: { type: 'created' },
  serviceTicketOkSchema: { type: 'ok' },
  partListItemSchema: { type: 'ticket-part' },
}))

import { metadata, openApi } from '../parts/route'

type CrudRouteConfig = {
  metadata: Record<string, unknown>
  list: {
    sortFieldMap: Record<string, string>
    buildFilters: (query: Record<string, string>) => Promise<Record<string, unknown>>
    transformItem: (item: Record<string, unknown>) => Record<string, unknown>
  }
}

function getRouteConfig(): CrudRouteConfig {
  const call = mockMakeCrudRoute.mock.calls[0]
  return call[0] as CrudRouteConfig
}

describe('service ticket parts route', () => {
  it('registers service ticket part CRUD metadata', () => {
    expect(metadata).toEqual({
      GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
      POST: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
      PUT: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
      DELETE: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
    })

    const config = getRouteConfig()
    expect(config.list.sortFieldMap).toEqual({
      id: 'id',
      created_at: 'created_at',
      quantity: 'quantity',
    })
    expect(openApi).toBeDefined()
  })

  it('builds filters and normalizes response items', async () => {
    const config = getRouteConfig()

    await expect(
      config.list.buildFilters({
        id: 'part-1',
        ticket_id: 'ticket-1',
      }),
    ).resolves.toEqual({
      id: 'part-1',
      ticket_id: 'ticket-1',
    })

    expect(
      config.list.transformItem({
        id: 'part-1',
        ticket_id: 'ticket-1',
        product_id: 'product-1',
        quantity: '2',
        notes: 'Bring sealant',
        tenant_id: 'tenant-1',
        organization_id: 'org-1',
        created_at: new Date('2026-04-11T09:00:00.000Z'),
      }),
    ).toEqual({
      id: 'part-1',
      ticket_id: 'ticket-1',
      product_id: 'product-1',
      quantity: 2,
      notes: 'Bring sealant',
      tenant_id: 'tenant-1',
      organization_id: 'org-1',
      created_at: '2026-04-11T09:00:00.000Z',
    })
  })
})
