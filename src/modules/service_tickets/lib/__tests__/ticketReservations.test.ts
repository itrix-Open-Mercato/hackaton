/**
 * @jest-environment node
 */
import { TechnicianReservation, TechnicianReservationTechnician } from '../../../technician_schedule/data/entities'
import { Technician } from '../../../technicians/data/entities'
import {
  loadTicketReservationSummaries,
  syncTicketReservations,
} from '../ticketReservations'

function createMockEm(params: {
  technicians?: Array<{ id: string; staffMemberId: string; tenantId: string; organizationId: string; deletedAt: null; isActive: boolean }>
  reservations?: Array<any>
  assignments?: Array<any>
  technicianRows?: Array<{ id: string; display_name: string | null; first_name: string | null; last_name: string | null }>
  overlapRows?: Array<{ technician_id: string }>
}) {
  const technicians = [...(params.technicians ?? [])]
  const reservations = [...(params.reservations ?? [])]
  const assignments = [...(params.assignments ?? [])]
  const technicianRows = [...(params.technicianRows ?? [])]
  const overlapRows = [...(params.overlapRows ?? [])]

  const knexFactory = () => {
    const tableFn = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue(technicianRows),
    }))
    return tableFn
  }

  const em = {
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === Technician) {
        const ids = ((where.staffMemberId as { $in?: string[] })?.$in ?? []) as string[]
        return technicians.filter((item) => ids.includes(item.staffMemberId))
      }

      if (entity === TechnicianReservation) {
        const sourceTicketId = typeof where.sourceTicketId === 'string'
          ? where.sourceTicketId
          : Array.isArray((where.sourceTicketId as { $in?: string[] })?.$in)
            ? null
            : null
        const sourceTicketIds = Array.isArray((where.sourceTicketId as { $in?: string[] })?.$in)
          ? (where.sourceTicketId as { $in: string[] }).$in
          : sourceTicketId
            ? [sourceTicketId]
            : []
        return reservations.filter((item) => sourceTicketIds.includes(item.sourceTicketId))
      }

      if (entity === TechnicianReservationTechnician) {
        const reservationIds = Array.isArray((where.reservationId as { $in?: string[] })?.$in)
          ? (where.reservationId as { $in: string[] }).$in
          : typeof where.reservationId === 'string'
            ? [where.reservationId]
            : []
        return assignments.filter((item) => reservationIds.includes(item.reservationId))
      }

      return []
    }),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ ...data })),
    persist: jest.fn((entity: Record<string, unknown>) => {
      if ('reservationType' in entity) {
        reservations.push(entity)
      } else if ('reservationId' in entity) {
        assignments.push(entity)
      }
    }),
    remove: jest.fn((entity: Record<string, unknown>) => {
      const index = assignments.indexOf(entity)
      if (index >= 0) assignments.splice(index, 1)
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(() => ({
      execute: jest.fn().mockResolvedValue(overlapRows),
      getKnex: jest.fn(() => knexFactory()),
    })),
    getKnex: jest.fn(() => knexFactory()),
  }

  return { em: em as any, reservations, assignments }
}

describe('ticketReservations helper', () => {
  it('creates one service-ticket reservation per resolved technician', async () => {
    const { em, reservations, assignments } = createMockEm({
      technicians: [{
        id: 'tech-1',
        staffMemberId: 'staff-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        deletedAt: null,
        isActive: true,
      }],
    })

    await syncTicketReservations({
      em,
      ticket: {
        id: 'ticket-1',
        ticketNumber: 'SRV-000001',
        status: 'scheduled',
        visitDate: new Date('2026-04-12T09:00:00.000Z'),
        visitEndDate: null,
        address: 'Main Street',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
      staffMemberIds: ['staff-1'],
    })

    expect(reservations).toHaveLength(1)
    expect(reservations[0]).toMatchObject({
      sourceType: 'service_ticket',
      sourceTicketId: 'ticket-1',
      status: 'auto_confirmed',
    })
    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({
      technicianId: 'tech-1',
    })
  })

  it('defaults an invalid visit end date to a one-hour reservation window', async () => {
    const { em, reservations } = createMockEm({
      technicians: [{
        id: 'tech-1',
        staffMemberId: 'staff-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        deletedAt: null,
        isActive: true,
      }],
    })

    await syncTicketReservations({
      em,
      ticket: {
        id: 'ticket-1',
        ticketNumber: 'SRV-000001',
        status: 'scheduled',
        visitDate: new Date('2026-04-12T09:00:00.000Z'),
        visitEndDate: new Date('2026-04-12T09:00:00.000Z'),
        address: 'Main Street',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
      staffMemberIds: ['staff-1'],
    })

    expect(reservations).toHaveLength(1)
    expect((reservations[0].startsAt as Date).toISOString()).toBe('2026-04-12T09:00:00.000Z')
    expect((reservations[0].endsAt as Date).toISOString()).toBe('2026-04-12T10:00:00.000Z')
  })

  it('cancels source-linked reservations when the ticket becomes inactive for scheduling', async () => {
    const existingReservation = {
      id: 'res-1',
      sourceType: 'service_ticket',
      sourceTicketId: 'ticket-1',
      status: 'auto_confirmed',
      isActive: true,
      updatedAt: new Date('2026-04-12T08:00:00.000Z'),
    }
    const { em } = createMockEm({
      reservations: [existingReservation],
      assignments: [{ reservationId: 'res-1', technicianId: 'tech-1' }],
    })

    await syncTicketReservations({
      em,
      ticket: {
        id: 'ticket-1',
        ticketNumber: 'SRV-000001',
        status: 'completed',
        visitDate: new Date('2026-04-12T09:00:00.000Z'),
        visitEndDate: null,
        address: 'Main Street',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
      staffMemberIds: ['staff-1'],
    })

    expect(existingReservation.status).toBe('cancelled')
    expect(existingReservation.isActive).toBe(false)
  })

  it('returns reservation summaries grouped by ticket', async () => {
    const { em } = createMockEm({
      reservations: [{
        id: 'res-1',
        sourceType: 'service_ticket',
        sourceTicketId: 'ticket-1',
        startsAt: new Date('2026-04-12T09:00:00.000Z'),
        endsAt: new Date('2026-04-12T10:00:00.000Z'),
        status: 'auto_confirmed',
        deletedAt: null,
      }],
      assignments: [{ reservationId: 'res-1', technicianId: 'tech-1' }],
      technicianRows: [{ id: 'tech-1', display_name: 'Jane Doe', first_name: null, last_name: null }],
    })

    const summaries = await loadTicketReservationSummaries({
      em,
      ticketIds: ['ticket-1'],
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    })

    expect(summaries.get('ticket-1')).toEqual([
      expect.objectContaining({
        id: 'res-1',
        technicianIds: ['tech-1'],
        technicianNames: ['Jane Doe'],
        sourceTicketId: 'ticket-1',
      }),
    ])
  })

  it('rejects ticket reservation sync when a blocking availability marker overlaps the visit window', async () => {
    const { em, reservations, assignments } = createMockEm({
      technicians: [{
        id: 'tech-1',
        staffMemberId: 'staff-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        deletedAt: null,
        isActive: true,
      }],
      overlapRows: [{ technician_id: 'tech-1' }],
    })

    await expect(syncTicketReservations({
      em,
      ticket: {
        id: 'ticket-1',
        ticketNumber: 'SRV-000001',
        status: 'scheduled',
        visitDate: new Date('2026-04-12T09:00:00.000Z'),
        visitEndDate: new Date('2026-04-12T10:00:00.000Z'),
        address: 'Main Street',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
      staffMemberIds: ['staff-1'],
    })).rejects.toThrow()

    expect(reservations).toHaveLength(0)
    expect(assignments).toHaveLength(0)
  })
})
