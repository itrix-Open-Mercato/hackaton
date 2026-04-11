/**
 * @jest-environment node
 */
const mockRegisterCommand = jest.fn()
const mockEmitCrudSideEffects = jest.fn()
const mockRequireId = jest.fn()

const TECH_ID = '11111111-1111-4111-8111-111111111111'
const STAFF_MEMBER_ID = '22222222-2222-4222-8222-222222222222'

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: (...args: unknown[]) => mockRegisterCommand(...args),
}))

jest.mock('@open-mercato/shared/lib/commands/helpers', () => ({
  emitCrudSideEffects: (...args: unknown[]) => mockEmitCrudSideEffects(...args),
  requireId: (...args: unknown[]) => mockRequireId(...args),
}))

jest.mock('../../events', () => ({
  emitTechnicianEvent: jest.fn(),
  eventsConfig: { emit: jest.fn() },
  default: { emit: jest.fn() },
}))

import {
  createTechnicianCommand,
  updateTechnicianCommand,
  deleteTechnicianCommand,
} from '../technicians'

function createCtx(overrides: {
  dataEngine?: Record<string, unknown>
  em?: Record<string, unknown>
} = {}) {
  const dataEngine = overrides.dataEngine ?? {}
  const em = overrides.em ?? {}

  return {
    auth: {
      tenantId: 'tenant-1',
      orgId: 'org-1',
      userId: 'user-1',
    },
    selectedOrganizationId: 'org-1',
    container: {
      resolve: (key: string) => {
        if (key === 'dataEngine') return dataEngine
        if (key === 'em') return em
        throw new Error(`Unexpected dependency: ${key}`)
      },
    },
  }
}

describe('technicians commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a technician profile with skills', async () => {
    const createOrmEntity = jest.fn()
      .mockResolvedValueOnce({ id: TECH_ID, staffMemberId: STAFF_MEMBER_ID }) // technician
      .mockResolvedValue({ id: 'skill-1' }) // skills
    const em = {
      findOne: jest.fn().mockResolvedValue(null), // no existing profile
    }

    const result = await createTechnicianCommand.execute(
      {
        staff_member_id: STAFF_MEMBER_ID,
        is_active: true,
        skills: ['Electrical', 'HVAC'],
      },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: TECH_ID, staffMemberId: STAFF_MEMBER_ID })
    // 1 technician + 2 skills = 3 calls
    expect(createOrmEntity).toHaveBeenCalledTimes(3)
    expect(mockEmitCrudSideEffects).toHaveBeenCalled()
  })

  it('rejects duplicate technician profile with 409', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing-tech' }), // existing profile
    }

    await expect(
      createTechnicianCommand.execute(
        { staff_member_id: STAFF_MEMBER_ID },
        createCtx({ em }),
      ),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('deduplicates skills on create', async () => {
    const createOrmEntity = jest.fn()
      .mockResolvedValueOnce({ id: TECH_ID, staffMemberId: STAFF_MEMBER_ID })
      .mockResolvedValue({ id: 'skill-1' })
    const em = {
      findOne: jest.fn().mockResolvedValue(null),
    }

    await createTechnicianCommand.execute(
      {
        staff_member_id: STAFF_MEMBER_ID,
        skills: ['Electrical', 'Electrical', 'HVAC'],
      },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    // 1 technician + 2 unique skills = 3 calls
    expect(createOrmEntity).toHaveBeenCalledTimes(3)
  })

  it('updates technician isActive field', async () => {
    const updateOrmEntity = jest.fn().mockImplementation(async ({ apply }) => {
      const entity = { id: TECH_ID, isActive: true, notes: null }
      apply(entity)
      return entity
    })

    const result = await updateTechnicianCommand.execute(
      { id: TECH_ID, is_active: false },
      createCtx({ dataEngine: { updateOrmEntity } }),
    )

    expect(result).toMatchObject({ id: TECH_ID, isActive: false })
    expect(mockEmitCrudSideEffects).toHaveBeenCalled()
  })

  it('returns 404 when updating non-existent technician', async () => {
    const updateOrmEntity = jest.fn().mockResolvedValue(null)

    await expect(
      updateTechnicianCommand.execute(
        { id: TECH_ID, is_active: false },
        createCtx({ dataEngine: { updateOrmEntity } }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('soft deletes technician', async () => {
    const deleteOrmEntity = jest.fn().mockResolvedValue({ id: TECH_ID })
    mockRequireId.mockReturnValueOnce(TECH_ID)

    const result = await deleteTechnicianCommand.execute(
      { query: { id: TECH_ID } },
      createCtx({ dataEngine: { deleteOrmEntity } }),
    )

    expect(deleteOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        soft: true,
        softDeleteField: 'deletedAt',
      }),
    )
    expect(result).toMatchObject({ id: TECH_ID })
    expect(mockEmitCrudSideEffects).toHaveBeenCalled()
  })

  it('returns 404 when deleting non-existent technician', async () => {
    const deleteOrmEntity = jest.fn().mockResolvedValue(null)
    mockRequireId.mockReturnValueOnce(TECH_ID)

    await expect(
      deleteTechnicianCommand.execute(
        { query: { id: TECH_ID } },
        createCtx({ dataEngine: { deleteOrmEntity } }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
