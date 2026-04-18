/** @jest-environment node */
import { TechnicianReservation, TechnicianReservationTechnician } from '../../data/entities'
import { createReservationCommand, updateReservationCommand } from '../reservations'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { checkReservationOverlap } from '../../lib/overlapCheck'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222'
const TECHNICIAN_ONE_ID = '33333333-3333-4333-8333-333333333333'
const TECHNICIAN_TWO_ID = '44444444-4444-4444-8444-444444444444'
const RESERVATION_ID = '55555555-5555-4555-8555-555555555555'

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: jest.fn(),
}))

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: jest.fn(async () => ({ translate: (_key: string, fallback: string) => fallback })),
}))

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findOneWithDecryption: jest.fn(),
  findWithDecryption: jest.fn(),
}))

jest.mock('../../lib/overlapCheck', () => ({
  checkReservationOverlap: jest.fn(),
}))

type ReservationRecord = TechnicianReservation & Record<string, unknown>
type AssignmentRecord = TechnicianReservationTechnician & Record<string, unknown>

function createEntityManager() {
  const reservations: ReservationRecord[] = []
  const assignments: AssignmentRecord[] = []

  const em = {
    fork: jest.fn(),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ ...data })),
    persist: jest.fn((entity: Record<string, unknown>) => {
      if ('reservationId' in entity) {
        assignments.push(entity as AssignmentRecord)
        return
      }
      reservations.push(entity as ReservationRecord)
    }),
    remove: jest.fn((entity: Record<string, unknown>) => {
      const collection = 'reservationId' in entity ? assignments : reservations
      const index = collection.indexOf(entity as never)
      if (index >= 0) collection.splice(index, 1)
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  }

  em.fork.mockReturnValue(em)
  em.persist.mockImplementation((entity: Record<string, unknown>) => {
    if ('reservationId' in entity) {
      assignments.push(entity as AssignmentRecord)
      return
    }
    reservations.push(entity as ReservationRecord)
  })

  return { em: em as unknown, reservations, assignments }
}

function createCtx(em: unknown) {
  return {
    container: {
      resolve: jest.fn((key: string) => {
        if (key === 'em') return em
        return null
      }),
    },
    auth: { tenantId: TENANT_ID, orgId: ORGANIZATION_ID },
    selectedOrganizationId: ORGANIZATION_ID,
    organizationIds: [ORGANIZATION_ID],
    organizationScope: null,
    request: null,
  } as any
}

describe('reservation commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(checkReservationOverlap).mockResolvedValue({
      hasConflict: false,
      conflictingTechnicianIds: [],
    })
    jest.mocked(findWithDecryption).mockImplementation(async (_em, entity, where) => {
      if (entity === TechnicianReservationTechnician && (where as Record<string, unknown>).reservationId === RESERVATION_ID) {
        return [{ technicianId: TECHNICIAN_ONE_ID, reservationId: RESERVATION_ID }] as never
      }
      return [] as never
    })
    jest.mocked(findOneWithDecryption).mockResolvedValue(null as never)
  })

  it('creates manual availability reservations with unified metadata', async () => {
    const { em, reservations, assignments } = createEntityManager()
    const ctx = createCtx(em)

    const result = await createReservationCommand.execute({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      technicianIds: [TECHNICIAN_ONE_ID],
      startsAt: '2026-04-15T00:00:00.000Z',
      endsAt: '2026-04-15T23:59:59.999Z',
      entryKind: 'availability',
      availabilityType: 'holiday',
      allDay: true,
      status: 'confirmed',
      sourceType: 'manual',
    }, ctx)

    expect(result.reservationId).toBeTruthy()
    expect(reservations).toHaveLength(1)
    expect(reservations[0]).toMatchObject({
      entryKind: 'availability',
      availabilityType: 'holiday',
      allDay: true,
      reservationType: null,
      title: 'Holiday',
    })
    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({
      technicianId: TECHNICIAN_ONE_ID,
    })
  })

  it('rejects manual reservation creation when overlap check reports a conflict', async () => {
    const { em } = createEntityManager()
    const ctx = createCtx(em)
    jest.mocked(checkReservationOverlap).mockResolvedValueOnce({
      hasConflict: true,
      conflictingTechnicianIds: [TECHNICIAN_ONE_ID],
    })

    await expect(
      createReservationCommand.execute({
        tenantId: TENANT_ID,
        organizationId: ORGANIZATION_ID,
        technicianIds: [TECHNICIAN_ONE_ID],
        startsAt: '2026-04-15T09:00:00.000Z',
        endsAt: '2026-04-15T10:00:00.000Z',
        reservationType: 'client_visit',
        entryKind: 'reservation',
        allDay: false,
        status: 'confirmed',
        sourceType: 'manual',
      }, ctx),
    ).rejects.toMatchObject({
      status: 409,
      body: expect.objectContaining({
        error: 'OVERLAP_CONFLICT',
        conflictingTechnicianIds: [TECHNICIAN_ONE_ID],
      }),
    })
  })

  it('updates manual reservations with unified metadata and technician assignments', async () => {
    const { em, reservations, assignments } = createEntityManager()
    const ctx = createCtx(em)
    const reservation = {
      id: RESERVATION_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      title: 'Trip',
      reservationType: null,
      entryKind: 'availability',
      availabilityType: 'trip',
      status: 'confirmed',
      sourceType: 'manual',
      sourceTicketId: null,
      sourceOrderId: null,
      startsAt: new Date('2026-04-15T00:00:00.000Z'),
      endsAt: new Date('2026-04-15T23:59:59.999Z'),
      allDay: true,
      vehicleId: null,
      vehicleLabel: null,
      customerName: null,
      address: null,
      notes: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date('2026-04-14T10:00:00.000Z'),
    } as ReservationRecord
    reservations.push(reservation)
    assignments.push({
      reservationId: RESERVATION_ID,
      technicianId: TECHNICIAN_ONE_ID,
      organizationId: ORGANIZATION_ID,
      tenantId: TENANT_ID,
    } as AssignmentRecord)

    jest.mocked(findOneWithDecryption).mockImplementation(async (_em, entity, where) => {
      if (entity === TechnicianReservation && (where as Record<string, unknown>).id === RESERVATION_ID) {
        return reservation as never
      }
      return null as never
    })
    jest.mocked(findWithDecryption).mockImplementation(async (_em, entity, where) => {
      if (entity === TechnicianReservationTechnician && (where as Record<string, unknown>).reservationId === RESERVATION_ID) {
        return assignments as never
      }
      return [] as never
    })

    const result = await updateReservationCommand.execute({
      id: RESERVATION_ID,
      technicianIds: [TECHNICIAN_TWO_ID],
      entryKind: 'availability',
      availabilityType: 'holiday',
      allDay: true,
      startsAt: '2026-04-16T00:00:00.000Z',
      endsAt: '2026-04-16T23:59:59.999Z',
      notes: 'Out of office',
    }, ctx)

    expect(result).toEqual({ reservationId: RESERVATION_ID })
    expect(reservation).toMatchObject({
      entryKind: 'availability',
      availabilityType: 'holiday',
      allDay: true,
      notes: 'Out of office',
    })
    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({
      reservationId: RESERVATION_ID,
      technicianId: TECHNICIAN_TWO_ID,
    })
  })
})
