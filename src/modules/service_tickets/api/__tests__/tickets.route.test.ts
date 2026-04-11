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

jest.mock('../../commands/tickets', () => ({
  ticketCrudEvents: {
    module: 'service_tickets',
    entity: 'ticket',
    persistent: true,
  },
  ticketCrudIndexer: {
    entityType: 'service_tickets:service_ticket',
  },
}))

jest.mock('../openapi', () => ({
  createServiceTicketCrudOpenApi: jest.fn((config: unknown) => config),
  createServiceTicketPagedListResponseSchema: jest.fn((schema: unknown) => schema),
  serviceTicketCreatedSchema: { type: 'created' },
  serviceTicketOkSchema: { type: 'ok' },
  ticketListItemSchema: { type: 'ticket-list-item' },
}))

import { metadata, openApi } from '../tickets/route'

type CrudRouteConfig = {
  metadata: Record<string, unknown>
  indexer: Record<string, unknown>
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

describe('service tickets route', () => {
  it('registers CRUD metadata and indexer for service tickets', () => {
    expect(metadata).toEqual({
      GET: { requireAuth: true, requireFeatures: ['service_tickets.view'] },
      POST: { requireAuth: true, requireFeatures: ['service_tickets.create'] },
      PUT: { requireAuth: true, requireFeatures: ['service_tickets.edit'] },
      DELETE: { requireAuth: true, requireFeatures: ['service_tickets.delete'] },
    })

    const config = getRouteConfig()
    expect(config.indexer).toEqual({ entityType: 'service_tickets:service_ticket' })
    expect(config.list.sortFieldMap).toEqual({
      id: 'id',
      ticketNumber: 'ticket_number',
      serviceType: 'service_type',
      status: 'status',
      priority: 'priority',
      visitDate: 'visit_date',
      createdAt: 'created_at',
    })
    expect(openApi).toBeDefined()
  })

  it('builds ticket filters for enum filters, escaped search, and datetime ranges', async () => {
    const config = getRouteConfig()

    const filters = await config.list.buildFilters({
      id: 'ticket-0',
      ids: 'ticket-1,ticket-2',
      status: 'scheduled,completed',
      service_type: 'maintenance,warranty_claim',
      priority: 'urgent,critical',
      customer_entity_id: 'customer-1',
      machine_instance_id: 'machine-1',
      search: '50%_off',
      visit_date_from: '2026-04-10T09:00:00.000Z',
      visit_date_to: '2026-04-11T17:30:00.000Z',
      created_at_from: '2026-04-01T08:15:00.000Z',
      created_at_to: '2026-04-30T18:45:00.000Z',
    })

    expect(filters).toMatchObject({
      id: { $in: ['ticket-1', 'ticket-2'] },
      status: { $in: ['scheduled', 'completed'] },
      service_type: { $in: ['maintenance', 'warranty_claim'] },
      priority: { $in: ['urgent', 'critical'] },
      customer_entity_id: 'customer-1',
      machine_instance_id: 'machine-1',
      $or: [
        { ticket_number: { $ilike: '%50\\%\\_off%' } },
        { description: { $ilike: '%50\\%\\_off%' } },
      ],
    })

    expect(filters.visit_date).toEqual({
      $gte: new Date('2026-04-10T09:00:00.000Z'),
      $lte: new Date('2026-04-11T17:30:00.000Z'),
    })

    expect(filters.created_at).toEqual({
      $gte: new Date('2026-04-01T08:15:00.000Z'),
      $lte: new Date('2026-04-30T18:45:00.000Z'),
    })
  })

  it('treats date-only ranges as full inclusive calendar days', async () => {
    const config = getRouteConfig()

    const filters = await config.list.buildFilters({
      visit_date_from: '2026-04-10',
      visit_date_to: '2026-04-11',
      created_at_from: '2026-04-01',
      created_at_to: '2026-04-30',
    })

    expect(filters.visit_date).toEqual({
      $gte: new Date('2026-04-10T00:00:00.000Z'),
      $lte: new Date('2026-04-11T23:59:59.999Z'),
    })

    expect(filters.created_at).toEqual({
      $gte: new Date('2026-04-01T00:00:00.000Z'),
      $lte: new Date('2026-04-30T23:59:59.999Z'),
    })
  })

  it('supports filtering by a singular id query parameter', async () => {
    const config = getRouteConfig()

    await expect(
      config.list.buildFilters({
        id: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('transforms both snake_case and camelCase route rows into API list items', () => {
    const config = getRouteConfig()

    const snakeCaseItem = config.list.transformItem({
      id: 'ticket-1',
      ticket_number: 'SRV-000001',
      service_type: 'maintenance',
      status: 'scheduled',
      priority: 'urgent',
      description: 'Needs inspection',
      visit_date: '2026-04-11T09:00:00.000Z',
      visit_end_date: '2026-04-11T12:00:00.000Z',
      address: 'Dock 7',
      customer_entity_id: 'customer-1',
      contact_person_id: 'person-1',
      machine_instance_id: 'machine-1',
      order_id: 'order-1',
      created_by_user_id: 'user-1',
      tenant_id: 'tenant-1',
      organization_id: 'org-1',
      created_at: '2026-04-10T08:00:00.000Z',
    })

    expect(snakeCaseItem).toEqual({
      id: 'ticket-1',
      ticketNumber: 'SRV-000001',
      serviceType: 'maintenance',
      status: 'scheduled',
      priority: 'urgent',
      description: 'Needs inspection',
      visitDate: '2026-04-11T09:00:00.000Z',
      visitEndDate: '2026-04-11T12:00:00.000Z',
      address: 'Dock 7',
      latitude: null,
      longitude: null,
      locationSource: null,
      geocodedAddress: null,
      customerEntityId: 'customer-1',
      contactPersonId: 'person-1',
      machineInstanceId: 'machine-1',
      orderId: 'order-1',
      createdByUserId: 'user-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      createdAt: '2026-04-10T08:00:00.000Z',
    })

    const camelCaseItem = config.list.transformItem({
      id: 'ticket-2',
      ticketNumber: 'SRV-000002',
      serviceType: 'commissioning',
      status: 'new',
      priority: 'normal',
      description: null,
      visitDate: '2026-04-12T07:00:00.000Z',
      visitEndDate: null,
      address: null,
      customerEntityId: null,
      contactPersonId: null,
      machineInstanceId: null,
      orderId: null,
      createdByUserId: null,
      tenantId: 'tenant-2',
      organizationId: 'org-2',
      createdAt: '2026-04-10T10:00:00.000Z',
    })

    expect(camelCaseItem).toEqual({
      id: 'ticket-2',
      ticketNumber: 'SRV-000002',
      serviceType: 'commissioning',
      status: 'new',
      priority: 'normal',
      description: null,
      visitDate: '2026-04-12T07:00:00.000Z',
      visitEndDate: null,
      address: null,
      latitude: null,
      longitude: null,
      locationSource: null,
      geocodedAddress: null,
      customerEntityId: null,
      contactPersonId: null,
      machineInstanceId: null,
      orderId: null,
      createdByUserId: null,
      tenantId: 'tenant-2',
      organizationId: 'org-2',
      createdAt: '2026-04-10T10:00:00.000Z',
    })
  })
})
