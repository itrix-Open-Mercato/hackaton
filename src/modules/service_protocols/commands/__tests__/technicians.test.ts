/**
 * @jest-environment node
 */
const mockRegisterCommand = jest.fn()
const mockEmitProtocolEvent = jest.fn()

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: (...args: unknown[]) => mockRegisterCommand(...args),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/crud/errors', () => ({
  CrudHttpError: class CrudHttpError extends Error {
    status: number
    payload: unknown
    constructor(status: number, payload: unknown) {
      super(
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error?: unknown }).error)
          : 'CrudHttpError',
      )
      this.status = status
      this.payload = payload
    }
  },
}), { virtual: true })

jest.mock('../../events', () => ({
  emitProtocolEvent: (...args: unknown[]) => mockEmitProtocolEvent(...args),
}))

// protocols.ts imports registerCommand too — mock it so the import doesn't fail
jest.mock('../protocols', () => {
  const original = jest.requireActual('../protocols')
  return { ...original }
})

import {
  createTechnicianCommand,
  updateTechnicianCommand,
  deleteTechnicianCommand,
} from '../technicians'

// ─── Shared UUIDs ─────────────────────────────────────────────────────────────
const PROTOCOL_ID = '11111111-1111-4111-8111-111111111111'
const TECH_ID     = '22222222-2222-4222-8222-222222222222'
const STAFF_ID    = '33333333-3333-4333-8333-333333333333'
const STAFF_ID_2  = '44444444-4444-4444-8444-444444444444'

// ─── Context helper ───────────────────────────────────────────────────────────
function createCtx(overrides: {
  em?: Record<string, unknown>
  dataEngine?: Record<string, unknown>
  features?: string[]
} = {}) {
  const em = overrides.em ?? {}
  const de = overrides.dataEngine ?? {}

  return {
    auth: {
      tenantId: 'tenant-1',
      orgId: 'org-1',
      userId: 'user-1',
      features: overrides.features ?? [],
    },
    selectedOrganizationId: 'org-1',
    organizationIds: ['org-1'],
    organizationScope: null,
    container: {
      resolve: (key: string) => {
        if (key === 'em') return em
        if (key === 'dataEngine') return de
        throw new Error(`Unexpected dependency: ${key}`)
      },
    },
  } as any
}

function makeDraftProtocol() {
  return { id: PROTOCOL_ID, status: 'draft' }
}
function makeApprovedProtocol() {
  return { id: PROTOCOL_ID, status: 'approved' }
}
function makeClosedProtocol() {
  return { id: PROTOCOL_ID, status: 'closed' }
}

// ─── createTechnicianCommand ──────────────────────────────────────────────────
describe('createTechnicianCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('adds a technician to a draft protocol and writes history', async () => {
    const createdTechnician = { id: TECH_ID, staffMemberId: STAFF_ID }
    const createOrmEntity = jest.fn().mockResolvedValue(createdTechnician)
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce(makeDraftProtocol()) // protocol lookup
        .mockResolvedValueOnce(null),               // duplicate check
    }

    const result = await createTechnicianCommand.execute(
      { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: TECH_ID, staffMemberId: STAFF_ID })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffMemberId: STAFF_ID,
          hoursWorked: 0,
          isBillable: false,
          kmDriven: 0,
        }),
      }),
    )
    // history entry written
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'technician_added' }),
      }),
    )
  })

  it('adds a technician to an in_review protocol', async () => {
    const createOrmEntity = jest.fn().mockResolvedValue({ id: TECH_ID, staffMemberId: STAFF_ID })
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ id: PROTOCOL_ID, status: 'in_review' })
        .mockResolvedValueOnce(null),
    }

    const result = await createTechnicianCommand.execute(
      { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: TECH_ID })
  })

  it('rejects adding technician to approved protocol', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValueOnce(makeApprovedProtocol()),
    }

    await expect(
      createTechnicianCommand.execute(
        { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects adding technician to closed protocol', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValueOnce(makeClosedProtocol()),
    }

    await expect(
      createTechnicianCommand.execute(
        { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects adding duplicate technician (same staff_member_id already on protocol)', async () => {
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce(makeDraftProtocol())
        .mockResolvedValueOnce({ id: TECH_ID, staffMemberId: STAFF_ID }), // already exists
    }

    await expect(
      createTechnicianCommand.execute(
        { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when protocol not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      createTechnicianCommand.execute(
        { protocol_id: PROTOCOL_ID, staff_member_id: STAFF_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateTechnicianCommand ──────────────────────────────────────────────────
describe('updateTechnicianCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeTechnicianEntity(protocolStatus = 'draft') {
    return {
      id: TECH_ID,
      staffMemberId: STAFF_ID,
      protocol: { id: PROTOCOL_ID, status: protocolStatus },
    }
  }

  function makeEm(techOverride: Record<string, unknown> | null, protocol: Record<string, unknown> | null) {
    return {
      findOne: jest.fn()
        .mockResolvedValueOnce(techOverride)
        .mockResolvedValueOnce(protocol),
    }
  }

  it('allows technician to update hours_worked, km_driven, and delegation fields', async () => {
    const updatedTech = { id: TECH_ID, hoursWorked: 6.5, kmDriven: 240 }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedTech)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeTechnicianEntity(), makeDraftProtocol())

    const result = await updateTechnicianCommand.execute(
      { id: TECH_ID, hours_worked: 6.5, km_driven: 240, delegation_days: 1, delegation_country: 'PL' },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: TECH_ID, hoursWorked: 6.5 })
    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = {}
    applyFn(entity)
    expect(entity.hoursWorked).toBe(6.5)
    expect(entity.kmDriven).toBe(240)
    expect(entity.delegationCountry).toBe('PL')
  })

  it('rejects billing field updates from a non-coordinator', async () => {
    const em = makeEm(makeTechnicianEntity(), makeDraftProtocol())

    await expect(
      updateTechnicianCommand.execute(
        { id: TECH_ID, is_billable: true },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects km billing field updates from a non-coordinator', async () => {
    const em = makeEm(makeTechnicianEntity(), makeDraftProtocol())

    await expect(
      updateTechnicianCommand.execute(
        { id: TECH_ID, km_is_billable: true },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('allows coordinator to set is_billable and rates', async () => {
    const updatedTech = { id: TECH_ID, isBillable: true, hourlyRateSnapshot: 180 }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedTech)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeTechnicianEntity(), makeDraftProtocol())

    const result = await updateTechnicianCommand.execute(
      { id: TECH_ID, is_billable: true, hourly_rate_snapshot: 180, km_rate_snapshot: 1.15, diet_rate_snapshot: 45 },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result).toMatchObject({ id: TECH_ID, isBillable: true })
    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = {}
    applyFn(entity)
    expect(entity.isBillable).toBe(true)
    expect(entity.hourlyRateSnapshot).toBe(180)
    expect(entity.kmRateSnapshot).toBe(1.15)
  })

  it('rejects update on a closed protocol', async () => {
    const em = makeEm(makeTechnicianEntity('closed'), makeClosedProtocol())

    await expect(
      updateTechnicianCommand.execute(
        { id: TECH_ID, hours_worked: 5 },
        createCtx({ dataEngine: { updateOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when technician line not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      updateTechnicianCommand.execute(
        { id: TECH_ID, hours_worked: 5 },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deleteTechnicianCommand ──────────────────────────────────────────────────
describe('deleteTechnicianCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeEm(opts: {
    tech?: Record<string, unknown> | null
    protocol?: Record<string, unknown> | null
    technicianCount?: number
  }) {
    const { tech = { id: TECH_ID, staffMemberId: STAFF_ID, protocol: { id: PROTOCOL_ID } }, protocol = makeDraftProtocol(), technicianCount = 2 } = opts

    return {
      findOne: jest.fn()
        .mockResolvedValueOnce(tech)
        .mockResolvedValueOnce(protocol),
      count: jest.fn().mockResolvedValue(technicianCount),
    }
  }

  it('soft deletes a technician when multiple technicians remain', async () => {
    const deletedTech = { id: TECH_ID }
    const deleteOrmEntity = jest.fn().mockResolvedValue(deletedTech)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm({ technicianCount: 2 })

    const result = await deleteTechnicianCommand.execute(
      { id: TECH_ID },
      createCtx({ dataEngine: { deleteOrmEntity, createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: TECH_ID })
    expect(deleteOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({ soft: true, softDeleteField: 'deletedAt' }),
    )
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'technician_removed' }),
      }),
    )
  })

  it('rejects removal of the last technician', async () => {
    const em = makeEm({ technicianCount: 1 })

    await expect(
      deleteTechnicianCommand.execute(
        { id: TECH_ID },
        createCtx({ dataEngine: { deleteOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects removal from a closed protocol', async () => {
    const em = makeEm({ protocol: makeClosedProtocol(), technicianCount: 2 })

    await expect(
      deleteTechnicianCommand.execute(
        { id: TECH_ID },
        createCtx({ dataEngine: { deleteOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when technician line not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null), count: jest.fn() }

    await expect(
      deleteTechnicianCommand.execute(
        { id: TECH_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
