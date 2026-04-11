/**
 * @jest-environment node
 */
const mockRegisterCommand = jest.fn()
const mockRequireId = jest.fn()

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: (...args: unknown[]) => mockRegisterCommand(...args),
}))

jest.mock('@open-mercato/shared/lib/commands/helpers', () => ({
  requireId: (...args: unknown[]) => mockRequireId(...args),
}))

import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import {
  createPartCommand,
  deletePartCommand,
  updatePartCommand,
} from '../parts'

const TICKET_ID = '11111111-1111-4111-8111-111111111111'
const PART_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'

function createCtx(overrides: {
  dataEngine?: Record<string, unknown>
  em?: Record<string, unknown>
  auth?: Record<string, unknown>
  selectedOrganizationId?: string
} = {}) {
  const dataEngine = overrides.dataEngine ?? {}
  const em = overrides.em ?? {}

  return {
    auth: {
      tenantId: 'tenant-1',
      orgId: 'org-1',
      userId: 'user-1',
      ...(overrides.auth ?? {}),
    },
    organizationScope: null,
    organizationIds: ['org-1'],
    selectedOrganizationId: overrides.selectedOrganizationId ?? 'org-1',
    container: {
      resolve: (key: string) => {
        if (key === 'dataEngine') return dataEngine
        if (key === 'em') return em
        throw new Error(`Unexpected dependency: ${key}`)
      },
    },
  } as any
}

describe('service_tickets part commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a part for an existing ticket', async () => {
    const ticket = { id: TICKET_ID }
    const createdPart = { id: PART_ID }
    const createOrmEntity = jest.fn().mockResolvedValue(createdPart)
    const em = {
      findOne: jest.fn().mockResolvedValue(ticket),
    }

    await expect(
      createPartCommand.execute(
        {
          ticket_id: TICKET_ID,
          product_id: PRODUCT_ID,
          quantity: 2,
          notes: 'Bring sealant',
        },
        createCtx({ dataEngine: { createOrmEntity }, em }),
      ),
    ).resolves.toBe(createdPart)

    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticket,
          productId: PRODUCT_ID,
          quantity: 2,
          notes: 'Bring sealant',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        }),
      }),
    )
  })

  it('rejects create when the ticket does not exist', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue(null),
    }

    await expect(
      createPartCommand.execute(
        {
          ticket_id: TICKET_ID,
          product_id: PRODUCT_ID,
          quantity: 2,
        },
        createCtx({ dataEngine: { createOrmEntity: jest.fn() }, em }),
      ),
    ).rejects.toEqual(new CrudHttpError(404, { error: 'Service ticket not found' }))
  })

  it('updates existing part fields', async () => {
    const existingPart = { id: PART_ID, quantity: 1, notes: null }
    const updateOrmEntity = jest.fn().mockImplementation(async ({ apply }) => {
      const entity = { ...existingPart }
      apply(entity)
      return entity
    })

    await expect(
      updatePartCommand.execute(
        { id: PART_ID, quantity: 3, notes: 'Updated note' },
        createCtx({ dataEngine: { updateOrmEntity } }),
      ),
    ).resolves.toMatchObject({
      id: PART_ID,
      quantity: 3,
      notes: 'Updated note',
    })
  })

  it('deletes an existing part by id', async () => {
    const part = { id: PART_ID }
    const em = {
      findOne: jest.fn().mockResolvedValue(part),
      remove: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
    }
    mockRequireId.mockReturnValueOnce(PART_ID)

    await expect(deletePartCommand.execute({ query: { id: PART_ID } }, createCtx({ em }))).resolves.toBe(part)

    expect(em.remove).toHaveBeenCalledWith(part)
    expect(em.flush).toHaveBeenCalled()
  })
})
