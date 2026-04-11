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
  createPartCommand,
  updatePartCommand,
  deletePartCommand,
} from '../parts'

// ─── Shared UUIDs ─────────────────────────────────────────────────────────────
const PROTOCOL_ID = '11111111-1111-4111-8111-111111111111'
const PART_ID     = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID  = '33333333-3333-4333-8333-333333333333'

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
function makeClosedProtocol() {
  return { id: PROTOCOL_ID, status: 'closed' }
}

// ─── createPartCommand ────────────────────────────────────────────────────────
describe('createPartCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a catalog-backed part on a draft protocol', async () => {
    const createdPart = { id: PART_ID, nameSnapshot: 'O-ring', lineStatus: 'added' }
    const createOrmEntity = jest.fn().mockResolvedValue(createdPart)
    const em = {
      findOne: jest.fn().mockResolvedValue(makeDraftProtocol()),
    }

    const result = await createPartCommand.execute(
      {
        protocol_id: PROTOCOL_ID,
        catalog_product_id: PRODUCT_ID,
        name_snapshot: 'O-ring',
        quantity_used: 2,
        unit: 'pcs',
      },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: PART_ID, nameSnapshot: 'O-ring' })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          catalogProductId: PRODUCT_ID,
          nameSnapshot: 'O-ring',
          quantityUsed: 2,
          unit: 'pcs',
          lineStatus: 'added',
        }),
      }),
    )
  })

  it('creates a manual part without catalog_product_id', async () => {
    const createdPart = { id: PART_ID, nameSnapshot: 'Field-sourced gasket', lineStatus: 'added' }
    const createOrmEntity = jest.fn().mockResolvedValue(createdPart)
    const em = {
      findOne: jest.fn().mockResolvedValue(makeDraftProtocol()),
    }

    const result = await createPartCommand.execute(
      {
        protocol_id: PROTOCOL_ID,
        name_snapshot: 'Field-sourced gasket',
        quantity_used: 1,
      },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ nameSnapshot: 'Field-sourced gasket' })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          catalogProductId: null,
          nameSnapshot: 'Field-sourced gasket',
        }),
      }),
    )
  })

  it('defaults line_status to "added" when not specified', async () => {
    const createOrmEntity = jest.fn().mockResolvedValue({ id: PART_ID, lineStatus: 'added' })
    const em = { findOne: jest.fn().mockResolvedValue(makeDraftProtocol()) }

    await createPartCommand.execute(
      { protocol_id: PROTOCOL_ID, name_snapshot: 'Part' },
      createCtx({ dataEngine: { createOrmEntity }, em }),
    )

    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lineStatus: 'added' }),
      }),
    )
  })

  it('rejects billing field (is_billable) without coordinator permission', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(makeDraftProtocol()) }

    await expect(
      createPartCommand.execute(
        { protocol_id: PROTOCOL_ID, name_snapshot: 'Part', is_billable: true },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects unit_price_snapshot without coordinator permission', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(makeDraftProtocol()) }

    await expect(
      createPartCommand.execute(
        { protocol_id: PROTOCOL_ID, name_snapshot: 'Part', unit_price_snapshot: 99 },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('coordinator can set is_billable and unit_price_snapshot', async () => {
    const createOrmEntity = jest.fn().mockResolvedValue({ id: PART_ID, isBillable: true, unitPriceSnapshot: 250 })
    const em = { findOne: jest.fn().mockResolvedValue(makeDraftProtocol()) }

    const result = await createPartCommand.execute(
      {
        protocol_id: PROTOCOL_ID,
        name_snapshot: 'Seal kit',
        is_billable: true,
        unit_price_snapshot: 250,
      },
      createCtx({
        dataEngine: { createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    expect(result).toMatchObject({ isBillable: true, unitPriceSnapshot: 250 })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isBillable: true, unitPriceSnapshot: 250 }),
      }),
    )
  })

  it('rejects adding a part to a closed protocol', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(makeClosedProtocol()) }

    await expect(
      createPartCommand.execute(
        { protocol_id: PROTOCOL_ID, name_snapshot: 'Part' },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when protocol not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      createPartCommand.execute(
        { protocol_id: PROTOCOL_ID, name_snapshot: 'Part' },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updatePartCommand ────────────────────────────────────────────────────────
describe('updatePartCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeProposedPart() {
    return { id: PART_ID, lineStatus: 'proposed', protocol: { id: PROTOCOL_ID } }
  }
  function makeConfirmedPart() {
    return { id: PART_ID, lineStatus: 'confirmed', protocol: { id: PROTOCOL_ID } }
  }

  function makeEm(part: Record<string, unknown> | null, protocol: Record<string, unknown> | null) {
    return {
      findOne: jest.fn()
        .mockResolvedValueOnce(part)
        .mockResolvedValueOnce(protocol),
    }
  }

  it('updates quantity_used and line_status', async () => {
    const updatedPart = { id: PART_ID, quantityUsed: 3, lineStatus: 'confirmed' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedPart)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeConfirmedPart(), makeDraftProtocol())

    const result = await updatePartCommand.execute(
      { id: PART_ID, quantity_used: 3, line_status: 'confirmed' },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: PART_ID, quantityUsed: 3, lineStatus: 'confirmed' })
  })

  it('auto-sets line_status to "removed" when quantity_used = 0 for proposed line', async () => {
    const updatedPart = { id: PART_ID, quantityUsed: 0, lineStatus: 'removed' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedPart)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeProposedPart(), makeDraftProtocol())

    await updatePartCommand.execute(
      { id: PART_ID, quantity_used: 0 },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = { lineStatus: 'proposed' }
    applyFn(entity)
    expect(entity.lineStatus).toBe('removed')
  })

  it('does NOT auto-set removed when quantity_used = 0 and line_status is explicitly set', async () => {
    const updateOrmEntity = jest.fn().mockResolvedValue({ id: PART_ID, lineStatus: 'confirmed' })
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeProposedPart(), makeDraftProtocol())

    await updatePartCommand.execute(
      { id: PART_ID, quantity_used: 0, line_status: 'confirmed' },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = { lineStatus: 'proposed' }
    applyFn(entity)
    // line_status was explicitly set to 'confirmed'
    expect(entity.lineStatus).toBe('confirmed')
  })

  it('rejects billing field updates without coordinator permission', async () => {
    const em = makeEm(makeConfirmedPart(), makeDraftProtocol())

    await expect(
      updatePartCommand.execute(
        { id: PART_ID, is_billable: true },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects unit_price_snapshot update without coordinator permission', async () => {
    const em = makeEm(makeConfirmedPart(), makeDraftProtocol())

    await expect(
      updatePartCommand.execute(
        { id: PART_ID, unit_price_snapshot: 150 },
        createCtx({ dataEngine: {}, em, features: [] }),
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('allows coordinator to set is_billable and unit_price_snapshot', async () => {
    const updateOrmEntity = jest.fn().mockResolvedValue({ id: PART_ID, isBillable: true, unitPriceSnapshot: 150 })
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(makeConfirmedPart(), makeDraftProtocol())

    await updatePartCommand.execute(
      { id: PART_ID, is_billable: true, unit_price_snapshot: 150 },
      createCtx({
        dataEngine: { updateOrmEntity, createOrmEntity },
        em,
        features: ['service_protocols.manage'],
      }),
    )

    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = {}
    applyFn(entity)
    expect(entity.isBillable).toBe(true)
    expect(entity.unitPriceSnapshot).toBe(150)
  })

  it('rejects update on a closed protocol', async () => {
    const em = makeEm(makeConfirmedPart(), makeClosedProtocol())

    await expect(
      updatePartCommand.execute(
        { id: PART_ID, quantity_used: 1 },
        createCtx({ dataEngine: { updateOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when part not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      updatePartCommand.execute(
        { id: PART_ID, quantity_used: 1 },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deletePartCommand ────────────────────────────────────────────────────────
describe('deletePartCommand', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeEm(part: Record<string, unknown> | null, protocol: Record<string, unknown> | null) {
    return {
      findOne: jest.fn()
        .mockResolvedValueOnce(part)
        .mockResolvedValueOnce(protocol),
    }
  }

  it('marks a proposed part as "removed" instead of deleting (preserves audit trail)', async () => {
    const updatedPart = { id: PART_ID, lineStatus: 'removed' }
    const updateOrmEntity = jest.fn().mockResolvedValue(updatedPart)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(
      { id: PART_ID, lineStatus: 'proposed', protocol: { id: PROTOCOL_ID } },
      makeDraftProtocol(),
    )

    const result = await deletePartCommand.execute(
      { id: PART_ID },
      createCtx({ dataEngine: { updateOrmEntity, createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ lineStatus: 'removed' })
    // updateOrmEntity used, not deleteOrmEntity
    expect(updateOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        apply: expect.any(Function),
      }),
    )
    const applyFn = updateOrmEntity.mock.calls[0][0].apply
    const entity: any = {}
    applyFn(entity)
    expect(entity.lineStatus).toBe('removed')
  })

  it('soft deletes an "added" part', async () => {
    const deletedPart = { id: PART_ID }
    const deleteOrmEntity = jest.fn().mockResolvedValue(deletedPart)
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(
      { id: PART_ID, lineStatus: 'added', protocol: { id: PROTOCOL_ID } },
      makeDraftProtocol(),
    )

    const result = await deletePartCommand.execute(
      { id: PART_ID },
      createCtx({ dataEngine: { deleteOrmEntity, createOrmEntity }, em }),
    )

    expect(result).toMatchObject({ id: PART_ID })
    expect(deleteOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({ soft: true, softDeleteField: 'deletedAt' }),
    )
  })

  it('soft deletes a "confirmed" part', async () => {
    const deleteOrmEntity = jest.fn().mockResolvedValue({ id: PART_ID })
    const createOrmEntity = jest.fn().mockResolvedValue({})
    const em = makeEm(
      { id: PART_ID, lineStatus: 'confirmed', protocol: { id: PROTOCOL_ID } },
      makeDraftProtocol(),
    )

    await deletePartCommand.execute(
      { id: PART_ID },
      createCtx({ dataEngine: { deleteOrmEntity, createOrmEntity }, em }),
    )

    expect(deleteOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({ soft: true }),
    )
  })

  it('rejects deletion on a closed protocol', async () => {
    const em = makeEm(
      { id: PART_ID, lineStatus: 'confirmed', protocol: { id: PROTOCOL_ID } },
      makeClosedProtocol(),
    )

    await expect(
      deletePartCommand.execute(
        { id: PART_ID },
        createCtx({ dataEngine: { deleteOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('returns 404 when part not found', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(
      deletePartCommand.execute(
        { id: PART_ID },
        createCtx({ dataEngine: {}, em }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
