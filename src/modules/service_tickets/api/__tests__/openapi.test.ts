/**
 * @jest-environment node
 */
import { ticketListItemSchema } from '../openapi'

describe('service ticket openapi schema', () => {
  it('parses the camelCase list item returned by the tickets route', () => {
    expect(
      ticketListItemSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 'SRV-000001',
        serviceType: 'maintenance',
        status: 'scheduled',
        priority: 'urgent',
        description: 'Loaded from API',
        visitDate: '2026-04-11T09:00:00.000Z',
        visitEndDate: '2026-04-11T11:00:00.000Z',
        address: 'Dock 7',
        latitude: 54.352,
        longitude: 18.646,
        customerEntityId: '22222222-2222-4222-8222-222222222222',
        contactPersonId: '33333333-3333-4333-8333-333333333333',
        machineInstanceId: '44444444-4444-4444-8444-444444444444',
        orderId: '55555555-5555-4555-8555-555555555555',
        staffMemberIds: ['66666666-6666-4666-8666-666666666666'],
        createdByUserId: '77777777-7777-4777-8777-777777777777',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        createdAt: '2026-04-10T08:00:00.000Z',
      }),
    ).toMatchObject({
      ticketNumber: 'SRV-000001',
      serviceType: 'maintenance',
      staffMemberIds: ['66666666-6666-4666-8666-666666666666'],
    })
  })
})
