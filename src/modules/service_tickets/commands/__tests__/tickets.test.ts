/**
 * @jest-environment node
 */
const mockRegisterCommand = jest.fn()
const mockEmitCrudSideEffects = jest.fn()
const mockRequireId = jest.fn()
const mockEmitServiceTicketEvent = jest.fn()
const TICKET_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID_A = '22222222-2222-4222-8222-222222222222'
const COMPANY_ID_B = '33333333-3333-4333-8333-333333333333'
const PERSON_ID = '44444444-4444-4444-8444-444444444444'

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: (...args: unknown[]) => mockRegisterCommand(...args),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/commands/helpers', () => ({
  emitCrudSideEffects: (...args: unknown[]) => mockEmitCrudSideEffects(...args),
  requireId: (...args: unknown[]) => mockRequireId(...args),
}), { virtual: true })

jest.mock('@open-mercato/shared/lib/crud/errors', () => ({
  CrudHttpError: class CrudHttpError extends Error {
    status: number
    payload: unknown

    constructor(status: number, payload: unknown) {
      super(typeof payload === 'object' && payload !== null && 'error' in payload ? String((payload as { error?: unknown }).error) : 'CrudHttpError')
      this.status = status
      this.payload = payload
    }
  },
}), { virtual: true })

jest.mock('../../events', () => ({
  emitServiceTicketEvent: (...args: unknown[]) => mockEmitServiceTicketEvent(...args),
}))

import {
  createTicketCommand,
  updateTicketCommand,
  deleteTicketCommand,
} from '../tickets'

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
    selectedOrganizationId: overrides.selectedOrganizationId ?? 'org-1',
    container: {
      resolve: (key: string) => {
        if (key === 'dataEngine') return dataEngine
        if (key === 'em') return em
        throw new Error(`Unexpected dependency: ${key}`)
      },
    },
  }
}

function createKnexMock(maxNum: string | null = 'SRV-000009') {
  return jest.fn(() => ({
    max: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ max_num: maxNum }]),
    }),
  }))
}

describe('service_tickets ticket commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates tickets with generated numbers and customer contact linkage', async () => {
    const createOrmEntity = jest.fn().mockResolvedValue({
      id: TICKET_ID,
      ticketNumber: 'SRV-000010',
    })
    const em = {
      getConnection: () => ({
        getKnex: () => createKnexMock(),
      }),
    }

    const result = await createTicketCommand.execute(
      {
        service_type: 'maintenance',
        customer_entity_id: COMPANY_ID_A,
        contact_person_id: PERSON_ID,
      },
      createCtx({
        dataEngine: { createOrmEntity },
        em,
      }),
    )

    expect(result).toEqual({ id: TICKET_ID, ticketNumber: 'SRV-000010' })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketNumber: 'SRV-000010',
          customerEntityId: COMPANY_ID_A,
          contactPersonId: PERSON_ID,
          machineInstanceId: null,
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        }),
      }),
    )
    expect(mockEmitCrudSideEffects).toHaveBeenCalled()
  })

  it('clears contact person when the linked company changes without a replacement contact', async () => {
    const existingTicket = {
      id: TICKET_ID,
      customerEntityId: COMPANY_ID_A,
      contactPersonId: PERSON_ID,
      visitDate: null,
      status: 'new',
    }
    const updateOrmEntity = jest.fn().mockImplementation(async ({ apply }) => {
      const entity = { ...existingTicket }
      apply(entity)
      return entity
    })
    const em = {
      findOne: jest.fn().mockResolvedValue(existingTicket),
      find: jest.fn().mockResolvedValue([]),
      flush: jest.fn().mockResolvedValue(undefined),
    }

    const result = await updateTicketCommand.execute(
      {
        id: TICKET_ID,
        customer_entity_id: COMPANY_ID_B,
      },
      createCtx({
        dataEngine: {
          updateOrmEntity,
          createOrmEntity: jest.fn(),
        },
        em,
      }),
    )

    expect(result).toMatchObject({
      customerEntityId: COMPANY_ID_B,
      contactPersonId: null,
    })
  })

  it('records visit date changes and emits status change events on update', async () => {
    const existingTicket = {
      id: TICKET_ID,
      customerEntityId: COMPANY_ID_A,
      contactPersonId: PERSON_ID,
      visitDate: new Date('2026-04-10T09:00:00.000Z'),
      status: 'new',
    }
    const createOrmEntity = jest.fn().mockResolvedValue({ id: 'change-1' })
    const updateOrmEntity = jest.fn().mockImplementation(async ({ apply }) => {
      const entity = { ...existingTicket }
      apply(entity)
      return entity
    })
    const em = {
      findOne: jest.fn().mockResolvedValue(existingTicket),
      find: jest.fn().mockResolvedValue([]),
      flush: jest.fn().mockResolvedValue(undefined),
    }

    const result = await updateTicketCommand.execute(
      {
        id: TICKET_ID,
        status: 'scheduled',
        visit_date: '2026-04-11T09:00:00.000Z',
      },
      createCtx({
        dataEngine: {
          updateOrmEntity,
          createOrmEntity,
        },
        em,
      }),
    )

    expect(result).toMatchObject({
      status: 'scheduled',
      visitDate: new Date('2026-04-11T09:00:00.000Z'),
    })
    expect(createOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldDate: existingTicket.visitDate,
          newDate: new Date('2026-04-11T09:00:00.000Z'),
        }),
      }),
    )
    expect(mockEmitServiceTicketEvent).toHaveBeenCalledWith(
      'service_tickets.ticket.status_changed',
      expect.objectContaining({
        id: TICKET_ID,
        oldStatus: 'new',
        newStatus: 'scheduled',
      }),
    )
  })

  it('soft deletes tickets by id', async () => {
    const deleteOrmEntity = jest.fn().mockResolvedValue({ id: TICKET_ID })
    mockRequireId.mockReturnValueOnce(TICKET_ID)

    const result = await deleteTicketCommand.execute(
      { query: { id: TICKET_ID } },
      createCtx({
        dataEngine: { deleteOrmEntity },
      }),
    )

    expect(mockRequireId).toHaveBeenCalled()
    expect(deleteOrmEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TICKET_ID,
          deletedAt: null,
        }),
        soft: true,
        softDeleteField: 'deletedAt',
      }),
    )
    expect(result).toEqual({ id: TICKET_ID })
  })
})
