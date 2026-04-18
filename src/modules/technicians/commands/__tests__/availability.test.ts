/** @jest-environment node */
import { TechnicianReservation } from '../../../technician_schedule/data/entities'
import { createAvailabilityCommand, updateAvailabilityCommand, deleteAvailabilityCommand } from '../availability'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const AVAIL_UUID = '22222222-2222-4222-8222-222222222222'

function createCtx(overrides?: {
  findOne?: jest.Mock
  reservationById?: Record<string, unknown> | null
  reservationRows?: Array<Record<string, unknown>>
  execute?: jest.Mock
  persist?: jest.Mock
}) {
  const reservationRows = overrides?.reservationRows ?? []
  const execute = overrides?.execute ?? jest.fn().mockResolvedValue([])
  const persist = overrides?.persist ?? jest.fn((entity) => {
    reservationRows.push(entity)
  })
  const em = {
    fork: jest.fn(),
    findOne: overrides?.findOne ?? jest.fn().mockResolvedValue({ id: VALID_UUID, tenantId: 't1', organizationId: 'o1', deletedAt: null }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === TechnicianReservation) return reservationRows
      return []
    }),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ ...data })),
    persist,
    flush: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(() => ({
      execute,
    })),
  }
  em.fork.mockReturnValue(em)

  const reservationById = overrides?.reservationById ?? null

  jest.mocked(findOneWithDecryption).mockImplementation(async (_em, entity, where) => {
    const typedWhere = where as Record<string, unknown>
    if (entity === TechnicianReservation && typedWhere.id === AVAIL_UUID) {
      return reservationById
    }
    return null
  })

  return {
    container: {
      resolve: jest.fn((key: string) => {
        if (key === 'em') return em
        return null
      }),
    },
    auth: { tenantId: 't1', orgId: 'o1' },
    selectedOrganizationId: 'o1',
    organizationIds: ['o1'],
    organizationScope: null,
    request: null,
    _em: em,
    _rows: reservationRows,
    _execute: execute,
  } as any
}

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findOneWithDecryption: jest.fn(),
}))

describe('createAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(createAvailabilityCommand.id).toBe('technicians.availability.create')
  })

  it('creates reservation-backed availability for non-default day types', async () => {
    const ctx = createCtx()
    const result = await createAvailabilityCommand.execute({
      technician_id: VALID_UUID,
      date: '2026-04-15',
      day_type: 'holiday',
    }, ctx)

    expect(result).toBeDefined()
    expect(ctx._rows).toHaveLength(1)
    expect(ctx._rows[0]).toMatchObject({
      entryKind: 'availability',
      availabilityType: 'holiday',
      allDay: true,
      reservationType: null,
    })
    expect(ctx._execute).toHaveBeenCalledTimes(1)
  })

  it('rejects explicit work_day writes because work day is implicit', async () => {
    const ctx = createCtx()
    await expect(
      createAvailabilityCommand.execute({ technician_id: VALID_UUID, date: '2026-04-15', day_type: 'work_day' }, ctx),
    ).rejects.toThrow()
  })
})

describe('updateAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(updateAvailabilityCommand.id).toBe('technicians.availability.update')
  })

  it('updates reservation-backed availability metadata', async () => {
    const reservation = {
      id: AVAIL_UUID,
      availabilityType: 'trip',
      title: 'Trip',
      notes: null,
      updatedAt: null,
    }
    const ctx = createCtx({ reservationById: reservation })
    const result = await updateAvailabilityCommand.execute({
      id: AVAIL_UUID,
      day_type: 'unavailable',
    }, ctx)

    expect(result).toBe(reservation)
    expect(reservation.availabilityType).toBe('unavailable')
    expect(reservation.title).toBe('Unavailable')
  })
})

describe('deleteAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(deleteAvailabilityCommand.id).toBe('technicians.availability.delete')
  })

  it('soft-deletes the reservation-backed availability row', async () => {
    const reservation = {
      id: AVAIL_UUID,
      deletedAt: null,
      isActive: true,
      updatedAt: null,
    }
    const ctx = createCtx({ reservationById: reservation })

    const result = await deleteAvailabilityCommand.execute({ id: AVAIL_UUID }, ctx)

    expect(result).toEqual({ ok: true })
    expect(reservation.deletedAt).toBeInstanceOf(Date)
    expect(reservation.isActive).toBe(false)
  })
})
