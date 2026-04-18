/** @jest-environment node */
import { GET, DELETE } from '../technicians/[id]/availability/route'
import { TechnicianReservation } from '../../../technician_schedule/data/entities'

const mockFindAndCount = jest.fn()
const mockExecute = jest.fn()
const mockCommandBusExecute = jest.fn()

jest.mock('@open-mercato/shared/lib/di/container', () => ({
  createRequestContainer: jest.fn(async () => ({
    resolve: (key: string) => {
      if (key === 'em') {
        return {
          findAndCount: mockFindAndCount,
          getConnection: () => ({ execute: mockExecute }),
        }
      }
      if (key === 'commandBus') {
        return {
          execute: mockCommandBusExecute,
        }
      }
      return null
    },
  })),
}))

jest.mock('@open-mercato/shared/lib/auth/server', () => ({
  getAuthFromRequest: jest.fn(async () => ({ tenantId: 'tenant-1', orgId: 'org-1' })),
}))

jest.mock('@open-mercato/core/modules/directory/utils/organizationScope', () => ({
  resolveOrganizationScopeForRequest: jest.fn(async () => ({
    selectedId: 'org-1',
    filterIds: ['org-1'],
  })),
}))

jest.mock('../../commands/availability', () => ({
  mapAvailabilityReservation: jest.fn((record: Record<string, unknown>, technicianId: string) => ({
    id: record.id,
    technician_id: technicianId,
    date: '2026-04-15',
    day_type: record.availabilityType,
    notes: record.notes ?? null,
    created_at: '2026-04-14T10:00:00.000Z',
    updated_at: '2026-04-14T10:00:00.000Z',
  })),
}))

describe('technician availability route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists reservation-backed availability markers for the requested technician', async () => {
    mockFindAndCount.mockResolvedValue([
      [{
        id: 'res-1',
        availabilityType: 'holiday',
        notes: 'Annual leave',
      } satisfies Partial<TechnicianReservation>],
      1,
    ])
    mockExecute.mockResolvedValue([
      { reservation_id: 'res-1', technician_id: 'tech-1' },
    ])

    const response = await GET(
      new Request('http://localhost/api/technicians/technicians/tech-1/availability?dateFrom=2026-04-01&dateTo=2026-04-30'),
      { params: Promise.resolve({ id: 'tech-1' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockFindAndCount).toHaveBeenCalledWith(
      TechnicianReservation,
      expect.objectContaining({
        entryKind: 'availability',
        deletedAt: null,
      }),
      expect.any(Object),
    )
    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'res-1',
        technician_id: 'tech-1',
        day_type: 'holiday',
      }),
    ])
  })

  it('deletes an availability marker through the reservation-backed command flow', async () => {
    mockCommandBusExecute.mockResolvedValue({ result: { ok: true } })

    const response = await DELETE(
      new Request('http://localhost/api/technicians/technicians/tech-1/availability?id=avail-1', {
        method: 'DELETE',
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockCommandBusExecute).toHaveBeenCalledWith('technicians.availability.delete', {
      input: { id: 'avail-1' },
      ctx: expect.any(Object),
    })
  })
})
