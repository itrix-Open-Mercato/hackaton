/** @jest-environment node */
import { createAvailabilityCommand, updateAvailabilityCommand, deleteAvailabilityCommand } from '../availability'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const AVAIL_UUID = '22222222-2222-4222-8222-222222222222'

function createCtx(overrides?: { findOne?: any; createOrmEntity?: any; updateOrmEntity?: any }) {
  const em = {
    findOne: overrides?.findOne ?? jest.fn().mockResolvedValue({ id: VALID_UUID, tenantId: 't1', organizationId: 'o1', deletedAt: null }),
    flush: jest.fn(),
  }
  const de = {
    createOrmEntity: overrides?.createOrmEntity ?? jest.fn().mockResolvedValue({ id: AVAIL_UUID, technicianId: VALID_UUID, date: '2026-04-15', dayType: 'work_day' }),
    updateOrmEntity: overrides?.updateOrmEntity ?? jest.fn().mockResolvedValue({ id: AVAIL_UUID, dayType: 'trip', deletedAt: null }),
  }
  return {
    container: {
      resolve: jest.fn((key: string) => {
        if (key === 'em') return em
        if (key === 'dataEngine') return de
        return null
      }),
    },
    auth: { tenantId: 't1', orgId: 'o1' },
    selectedOrganizationId: 'o1',
    organizationIds: ['o1'],
    organizationScope: null,
    request: null,
  } as any
}

describe('createAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(createAvailabilityCommand.id).toBe('technicians.availability.create')
  })

  it('creates availability record for valid input', async () => {
    const ctx = createCtx()
    const result = await createAvailabilityCommand.execute({
      technician_id: VALID_UUID,
      date: '2026-04-15',
      day_type: 'holiday',
    }, ctx)

    expect(result).toBeDefined()
    expect(ctx.container.resolve('dataEngine').createOrmEntity).toHaveBeenCalledTimes(1)
    const callArgs = ctx.container.resolve('dataEngine').createOrmEntity.mock.calls[0][0]
    expect(callArgs.data.technicianId).toBe(VALID_UUID)
    expect(callArgs.data.date).toBe('2026-04-15')
    expect(callArgs.data.dayType).toBe('holiday')
  })

  it('throws 404 when technician not found', async () => {
    const ctx = createCtx({ findOne: jest.fn().mockResolvedValue(null) })
    await expect(
      createAvailabilityCommand.execute({ technician_id: VALID_UUID, date: '2026-04-15' }, ctx)
    ).rejects.toThrow()
  })
})

describe('updateAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(updateAvailabilityCommand.id).toBe('technicians.availability.update')
  })

  it('updates day type', async () => {
    const ctx = createCtx()
    const result = await updateAvailabilityCommand.execute({
      id: AVAIL_UUID,
      day_type: 'trip',
    }, ctx)

    expect(result).toBeDefined()
    const de = ctx.container.resolve('dataEngine')
    expect(de.updateOrmEntity).toHaveBeenCalledTimes(1)
    const callArgs = de.updateOrmEntity.mock.calls[0][0]
    expect(callArgs.where.id).toBe(AVAIL_UUID)
  })

  it('throws 404 when record not found', async () => {
    const ctx = createCtx({ updateOrmEntity: jest.fn().mockResolvedValue(null) })
    await expect(
      updateAvailabilityCommand.execute({ id: AVAIL_UUID, day_type: 'trip' }, ctx)
    ).rejects.toThrow()
  })
})

describe('deleteAvailabilityCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('has correct command id', () => {
    expect(deleteAvailabilityCommand.id).toBe('technicians.availability.delete')
  })

  it('soft-deletes by setting deletedAt', async () => {
    const mockEntity = { id: AVAIL_UUID, deletedAt: null }
    const updateFn = jest.fn().mockImplementation(async ({ apply }) => {
      apply(mockEntity)
      return mockEntity
    })
    const ctx = createCtx({ updateOrmEntity: updateFn })

    const result = await deleteAvailabilityCommand.execute({ id: AVAIL_UUID }, ctx)

    expect(result).toEqual({ ok: true })
    expect(mockEntity.deletedAt).toBeInstanceOf(Date)
  })

  it('throws 404 when record not found', async () => {
    const ctx = createCtx({ updateOrmEntity: jest.fn().mockResolvedValue(null) })
    await expect(
      deleteAvailabilityCommand.execute({ id: AVAIL_UUID }, ctx)
    ).rejects.toThrow()
  })
})
