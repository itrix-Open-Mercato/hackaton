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

import {
  createProtocolFromTicketCommand,
  submitProtocolCommand,
  rejectProtocolCommand,
  approveProtocolCommand,
  closeProtocolCommand,
  cancelProtocolCommand,
  unlockProtocolCommand,
  updateProtocolCommand,
} from '../protocols'

// ─── Shared UUIDs ─────────────────────────────────────────────────────────────
const PROTOCOL_ID   = '11111111-1111-4111-8111-111111111111'
const TICKET_ID     = '22222222-2222-4222-8222-222222222222'
const STAFF_ID      = '33333333-3333-4333-8333-333333333333'
const CUSTOMER_ID   = '44444444-4444-4444-8444-444444444444'
const MACHINE_ID    = '55555555-5555-4555-8555-555555555555'

// ─── Context helpers ──────────────────────────────────────────────────────────
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

function makeKnex(overrides: {
  ticket?: Record<string, unknown> | null
  assignments?: Record<string, unknown>[]
  parts?: Record<string, unknown>[]
  products?: Record<string, unknown>[]
  maxProtocolNum?: string | null
} = {}) {
  const {
    ticket = null,
    assignments = [],
    parts = [],
    products = [],
    maxProtocolNum = null,
  } = overrides

  return jest.fn((table: string) => {
    if (table === 'service_tickets') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1),
        limit: jest.fn().mockResolvedValue(ticket ? [ticket] : []),
      }
    }
    if (table === 'service_ticket_assignments') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(assignments),
      }
    }
    if (table === 'service_ticket_parts') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(parts),
      }
    }
    if (table === 'catalog_products') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(products),
      }
    }
    // Default: for service_protocols (protocol number generation)
    return {
      max: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      mockReturnThis: jest.fn().mockReturnThis(),
      // handle chained .where().where()
      limit: jest.fn().mockResolvedValue([{ max_num: maxProtocolNum }]),
    }
  })
}

function makeKnexForProtocolNumber(maxNum: string | null = null) {
  return jest.fn((table: string) => {
    if (table === 'service_protocols') {
      return {
        max: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ max_num: maxNum }]),
          }),
        }),
      }
    }
    return {}
  })
}

// ─── createProtocolFromTicketCommand ─────────────────────────────────────────
describe('createProtocolFromTicketCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function buildKnex(opts: {
    ticket?: Record<string, unknown> | null
    assignments?: Record<string, unknown>[]
    parts?: Record<string, unknown>[]
    maxNum?: string | null
  } = {}) {
    const { ticket = { id: TICKET_ID, status: 'scheduled', customer_entity_id: CUSTOMER_ID, machine_instance_id: MACHINE_ID, description: 'Fix pump', visit_date: null, visit_end_date: null, address: null, contact_person_id: null }, assignments = [{ id: 'a1', staff_member_id: STAFF_ID }], parts = [], maxNum = null } = opts

    return jest.fn((table: string) => {
      if (table === 'service_tickets') {
        return {
          select: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(ticket ? [ticket] : []),
            }),
          }),
          where: jest.fn().mockReturnThis(),
          whereNot: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue(1),
        }
      }
      if (table === 'service_ticket_assignments') {
        return {
          select: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(assignments),
          }),
        }
      }
      if (table === 'service_ticket_parts') {
        return {
          select: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(parts),
          }),
        }
      }
      if (table === 'catalog_products') {
        return {
          select: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }
      }
      // service_protocols (protocol number)
      return {
        max: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ max_num: maxNum }]),
          }),
        }),
      }
    })
  }

  it('creates protocol with generated number and snapshots ticket data', async () => {
    const createdProtocol = { id: PROTOCOL_ID, protocolNumber: 'PROT-2026-0001', status: 'draft' }
    const createOrmEntity = jest.fn().mockResolvedValue(createdProtocol)
    const em = {
      getConnection: () => ({ getKnex: () => buildKnex() }),
      findOne: jest.fn().mockResolvedValue(null), // no existing protocol
    }

    const result = await createProtocolFromTicketCommand.execute(
      { service_ticket_id: TICKET_ID },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: PROTOCOL_ID, status: 'draft' })
    // Protocol entity was created
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceTicketId: TICKET_ID,
          status: 'draft',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        }),
      }),
    )
  })

  it('creates one technician line per assignment', async () => {
    const createdProtocol = { id: PROTOCOL_ID }
    const createOrmEntity = jest.fn().mockResolvedValue(createdProtocol)
    const assignments = [
      { id: 'a1', staff_member_id: STAFF_ID },
      { id: 'a2', staff_member_id: '66666666-6666-4666-8666-666666666666' },
    ]
    const em = {
      getConnection: () => ({ getKnex: () => buildKnex({ assignments }) }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await createProtocolFromTicketCommand.execute(
      { service_ticket_id: TICKET_ID },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    const technicianCalls = createOrmEntity.mock.calls.filter(
      ([arg]) => arg?.data?.staffMemberId !== undefined,
    )
    expect(technicianCalls).toHaveLength(2)
    expect(technicianCalls[0][0].data.staffMemberId).toBe(STAFF_ID)
  })

  it('creates part lines per ticket parts and writes history entry', async () => {
    const createdProtocol = { id: PROTOCOL_ID }
    const createOrmEntity = jest.fn().mockResolvedValue(createdProtocol)
    const parts = [
      { id: 'p1', product_id: '77777777-7777-4777-8777-777777777777', quantity: 2, notes: null },
    ]
    const em = {
      getConnection: () => ({ getKnex: () => buildKnex({ parts }) }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await createProtocolFromTicketCommand.execute(
      { service_ticket_id: TICKET_ID },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    const partCalls = createOrmEntity.mock.calls.filter(
      ([arg]) => arg?.data?.lineStatus !== undefined,
    )
    expect(partCalls).toHaveLength(1)
    expect(partCalls[0][0].data.lineStatus).toBe('proposed')

    const historyCalls = createOrmEntity.mock.calls.filter(
      ([arg]) => arg?.data?.eventType === 'created_from_ticket',
    )
    expect(historyCalls).toHaveLength(1)
  })

  it('rejects creation from ticket with status "new"', async () => {
    const em = {
      getConnection: () => ({
        getKnex: () => buildKnex({ ticket: { ...{}, id: TICKET_ID, status: 'new' } }),
      }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await expect(
      createProtocolFromTicketCommand.execute(
        { service_ticket_id: TICKET_ID },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects creation from ticket with status "cancelled"', async () => {
    const em = {
      getConnection: () => ({
        getKnex: () => buildKnex({ ticket: { id: TICKET_ID, status: 'cancelled' } }),
      }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await expect(
      createProtocolFromTicketCommand.execute(
        { service_ticket_id: TICKET_ID },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects creation when ticket has no assigned technicians', async () => {
    const em = {
      getConnection: () => ({
        getKnex: () => buildKnex({ assignments: [] }),
      }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await expect(
      createProtocolFromTicketCommand.execute(
        { service_ticket_id: TICKET_ID },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects creation when ticket not found', async () => {
    const em = {
      getConnection: () => ({
        getKnex: () => buildKnex({ ticket: null }),
      }),
      findOne: jest.fn().mockResolvedValue(null),
    }

    await expect(
      createProtocolFromTicketCommand.execute(
        { service_ticket_id: TICKET_ID },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects duplicate active protocol for the same ticket', async () => {
    const existingProtocol = { id: PROTOCOL_ID, status: 'draft' }
    const em = {
      getConnection: () => ({ getKnex: () => buildKnex() }),
      findOne: jest.fn().mockResolvedValue(existingProtocol),
    }

    await expect(
      createProtocolFromTicketCommand.execute(
        { service_ticket_id: TICKET_ID },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── submitProtocolCommand ────────────────────────────────────────────────────
describe('submitProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('transitions draft → in_review and writes history', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'in_review' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft' }),
    }

    const result = await submitProtocolCommand.execute(
      { id: PROTOCOL_ID },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    expect(result.status).toBe('in_review')
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'status_change',
          oldValue: { status: 'draft' },
          newValue: { status: 'in_review' },
        }),
      }),
    )
  })

  it('rejects submit from non-draft status', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'in_review' }),
    }

    await expect(
      submitProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: { updateOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when protocol not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      submitProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── rejectProtocolCommand ────────────────────────────────────────────────────
describe('rejectProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('transitions in_review → draft with rejection notes (coordinator)', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'draft' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'in_review' }),
    }

    const result = await rejectProtocolCommand.execute(
      { id: PROTOCOL_ID, notes: 'Missing work description' },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result.status).toBe('draft')
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'rejected',
          notes: 'Missing work description',
        }),
      }),
    )
  })

  it('returns 403 when caller lacks coordinator permission', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'in_review' }),
    }

    await expect(
      rejectProtocolCommand.execute(
        { id: PROTOCOL_ID, notes: 'Reason' },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects reject from non in_review status', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft' }),
    }

    await expect(
      rejectProtocolCommand.execute(
        { id: PROTOCOL_ID, notes: 'Reason' },
        createCtx({
          dataEngine: { updateOrmEntity: jest.fn() },
          em,
          features: ['service_protocols.manage'],
        }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── approveProtocolCommand ───────────────────────────────────────────────────
describe('approveProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('transitions in_review → approved (coordinator)', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'approved' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'in_review' }),
    }

    const result = await approveProtocolCommand.execute(
      { id: PROTOCOL_ID },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result.status).toBe('approved')
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'approved' }),
      }),
    )
  })

  it('returns 403 without coordinator permission', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'in_review' }),
    }

    await expect(
      approveProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects approve from non in_review status', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft' }),
    }

    await expect(
      approveProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({
          dataEngine: { updateOrmEntity: jest.fn() },
          em,
          features: ['service_protocols.manage'],
        }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── closeProtocolCommand ─────────────────────────────────────────────────────
describe('closeProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function approvedProtocol() {
    return {
      id: PROTOCOL_ID,
      status: 'approved',
      serviceTicketId: TICKET_ID,
      workDescription: 'Replaced pump seal',
    }
  }

  function makeTechnicians(hoursWorked: number[]) {
    return hoursWorked.map((h, i) => ({
      id: `tech-${i}`,
      staffMemberId: STAFF_ID,
      hoursWorked: h,
      kmDriven: 0,
      delegationDays: 0,
      hotelAmount: null,
      isBillable: false,
      kmIsBillable: false,
      hourlyRateSnapshot: null,
      kmRateSnapshot: null,
      dietRateSnapshot: null,
      hotelInvoiceRef: null,
    }))
  }

  function makeParts(statuses: string[]) {
    return statuses.map((s, i) => ({
      id: `part-${i}`,
      nameSnapshot: `Part ${i}`,
      lineStatus: s,
      quantityUsed: s === 'removed' ? 0 : 1,
      isBillable: false,
      unitPriceSnapshot: null,
      unit: null,
    }))
  }

  function makeTicketKnex() {
    return jest.fn((table: string) => ({
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
    }))
  }

  it('transitions approved → closed, writes cost summary and history', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'closed' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn()
        .mockResolvedValueOnce(makeTechnicians([8]))   // technicians
        .mockResolvedValueOnce(makeParts(['confirmed'])), // parts
      getConnection: () => ({ getKnex: () => makeTicketKnex() }),
    }

    const result = await closeProtocolCommand.execute(
      { id: PROTOCOL_ID, complete_service_ticket: false },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result.status).toBe('closed')
    expect(updateOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        apply: expect.any(Function),
      }),
    )
    // Check apply sets correct fields
    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = {}
    applyFn(entity)
    expect(entity.status).toBe('closed')
    expect(entity.isActive).toBe(false)
    expect(Array.isArray(entity.preparedCostSummary)).toBe(true)
  })

  it('does NOT update linked ticket when complete_service_ticket is false', async () => {
    const knexUpdate = jest.fn()
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn()
        .mockResolvedValueOnce(makeTechnicians([4]))
        .mockResolvedValueOnce(makeParts(['confirmed'])),
      getConnection: () => ({
        getKnex: () => jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          whereNot: jest.fn().mockReturnThis(),
          update: knexUpdate,
        })),
      }),
    }

    await closeProtocolCommand.execute(
      { id: PROTOCOL_ID, complete_service_ticket: false },
      createCtx({
        dataEngine: { updateOrmEntity: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }), createOrmEntity: jest.fn().mockResolvedValue({}) },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(knexUpdate).not.toHaveBeenCalled()
  })

  it('updates linked ticket when complete_service_ticket is true', async () => {
    const knexUpdate = jest.fn().mockResolvedValue(1)
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn()
        .mockResolvedValueOnce(makeTechnicians([4]))
        .mockResolvedValueOnce(makeParts(['confirmed'])),
      getConnection: () => ({
        getKnex: () => jest.fn((table: string) => ({
          where: jest.fn().mockReturnThis(),
          whereNot: jest.fn().mockReturnThis(),
          update: knexUpdate,
        })),
      }),
    }

    await closeProtocolCommand.execute(
      { id: PROTOCOL_ID, complete_service_ticket: true },
      createCtx({
        dataEngine: { updateOrmEntity: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }), createOrmEntity: jest.fn().mockResolvedValue({}) },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(knexUpdate).toHaveBeenCalled()
  })

  it('rejects close from non-approved status', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft', workDescription: 'Work done' }),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: ['service_protocols.manage'] }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects close when work_description is empty', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({
        ...approvedProtocol(),
        workDescription: '',
      }),
      find: jest.fn().mockResolvedValueOnce(makeTechnicians([8])).mockResolvedValueOnce([]),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: ['service_protocols.manage'] }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects close when work_description is whitespace only', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({
        ...approvedProtocol(),
        workDescription: '   ',
      }),
      find: jest.fn().mockResolvedValueOnce(makeTechnicians([8])).mockResolvedValueOnce([]),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: ['service_protocols.manage'] }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects close when no technician has hours_worked > 0', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn().mockResolvedValueOnce(makeTechnicians([0, 0])).mockResolvedValueOnce([]),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: ['service_protocols.manage'] }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects close when any part has line_status = proposed', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn()
        .mockResolvedValueOnce(makeTechnicians([8]))
        .mockResolvedValueOnce(makeParts(['confirmed', 'proposed'])),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: ['service_protocols.manage'] }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 403 without close or manage permission', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
    }

    await expect(
      closeProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('allows close with service_protocols.close feature (non-manager)', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'closed' }
    const em = {
      findOne: jest.fn().mockResolvedValue(approvedProtocol()),
      find: jest.fn()
        .mockResolvedValueOnce(makeTechnicians([5]))
        .mockResolvedValueOnce(makeParts(['confirmed'])),
      getConnection: () => ({ getKnex: () => jest.fn(() => ({ where: jest.fn().mockReturnThis(), whereNot: jest.fn().mockReturnThis(), update: jest.fn() })) }),
    }

    const result = await closeProtocolCommand.execute(
      { id: PROTOCOL_ID },
      createCtx({
        dataEngine: { updateOrmEntity: jest.fn().mockResolvedValue(updatedProtocol), createOrmEntity: jest.fn().mockResolvedValue({}) },
        em,
        features: ['service_protocols.close'],
      }),
    )

    expect(result.status).toBe('closed')
  })
})

// ─── cancelProtocolCommand ────────────────────────────────────────────────────
describe('cancelProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each(['draft', 'in_review', 'approved'])(
    'cancels protocol with status "%s"',
    async (status) => {
      const updatedProtocol = { id: PROTOCOL_ID, status: 'cancelled' }
      const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
      const createOrmEntity = jest.fn().mockResolvedValue({})
      const em = {
        findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status }),
      }

      const result = await cancelProtocolCommand.execute(
        { id: PROTOCOL_ID, notes: 'Created by mistake' },
        createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
      )

      expect(result.status).toBe('cancelled')
    },
  )

  it('rejects cancellation of a closed protocol', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }),
    }

    await expect(
      cancelProtocolCommand.execute(
        { id: PROTOCOL_ID },
        createCtx({ dataEngine: { updateOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── unlockProtocolCommand ────────────────────────────────────────────────────
describe('unlockProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('transitions closed → approved with notes (coordinator)', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'approved' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }),
    }

    const result = await unlockProtocolCommand.execute(
      { id: PROTOCOL_ID, notes: 'Correction after review' },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result.status).toBe('approved')
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'unlocked',
          notes: 'Correction after review',
        }),
      }),
    )
  })

  it('returns 403 without coordinator permission', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }),
    }

    await expect(
      unlockProtocolCommand.execute(
        { id: PROTOCOL_ID, notes: 'Reason' },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects unlock from non-closed status', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'approved' }),
    }

    await expect(
      unlockProtocolCommand.execute(
        { id: PROTOCOL_ID, notes: 'Reason' },
        createCtx({
          dataEngine: { updateOrmEntity: jest.fn() },
          em,
          features: ['service_protocols.manage'],
        }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── updateProtocolCommand ────────────────────────────────────────────────────
describe('updateProtocolCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('allows technician to update work_description, technician_notes, customer_notes', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'draft', workDescription: 'Pump fixed' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft' }),
    }

    const result = await updateProtocolCommand.execute(
      { id: PROTOCOL_ID, work_description: 'Pump fixed', technician_notes: 'Used gasket', customer_notes: 'All good' },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em, features: [] }),
    )

    expect(result.workDescription).toBe('Pump fixed')
  })

  it('rejects edit of a closed protocol', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'closed' }),
    }

    await expect(
      updateProtocolCommand.execute(
        { id: PROTOCOL_ID, work_description: 'Updated' },
        createCtx({ dataEngine: { updateOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('coordinator can update header snapshots when not approved/closed', async () => {
    const updatedProtocol = { id: PROTOCOL_ID, status: 'draft', customerEntityId: CUSTOMER_ID }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedProtocol)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: PROTOCOL_ID, status: 'draft' }),
    }

    const result = await updateProtocolCommand.execute(
      { id: PROTOCOL_ID, customer_entity_id: CUSTOMER_ID },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result.customerEntityId).toBe(CUSTOMER_ID)
  })
})
