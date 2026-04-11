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
const PERSON_ID_OTHER = '55555555-5555-4555-8555-555555555555'

jest.mock('@open-mercato/shared/lib/commands', () => ({
  registerCommand: (...args: unknown[]) => mockRegisterCommand(...args),
}))

jest.mock('@open-mercato/shared/lib/commands/helpers', () => ({
  emitCrudSideEffects: (...args: unknown[]) => mockEmitCrudSideEffects(...args),
  requireId: (...args: unknown[]) => mockRequireId(...args),
}))

jest.mock('../../events', () => ({
  emitServiceTicketEvent: (...args: unknown[]) => mockEmitServiceTicketEvent(...args),
}))

import {
  createTicketCommand,
  updateTicketCommand,
  deleteTicketCommand,
  validateContactPersonBelongsToCompany,
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

function createKnexMock(maxNum: string | null = 'SRV-000009', personRows: Record<string, unknown>[] = []) {
  return jest.fn((table: string) => {
    if (table === 'customer_people') {
      return {
        select: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(personRows),
          }),
        }),
      }
    }
    return {
      max: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ max_num: maxNum }]),
      }),
    }
  })
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
        getKnex: () => createKnexMock('SRV-000009', [{ entity_id: PERSON_ID }]),
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
      getConnection: () => ({
        getKnex: () => createKnexMock(),
      }),
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
      getConnection: () => ({
        getKnex: () => createKnexMock('SRV-000009', [{ entity_id: PERSON_ID }]),
      }),
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

  describe('validateContactPersonBelongsToCompany', () => {
    function createValidationEm(personRows: Record<string, unknown>[]) {
      const mockSelect = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(personRows),
        }),
      })
      const mockKnex = jest.fn(() => ({
        select: mockSelect,
      }))
      return {
        getConnection: () => ({
          getKnex: () => mockKnex,
        }),
      }
    }

    it('passes when contact person belongs to the company', async () => {
      const em = createValidationEm([{ entity_id: PERSON_ID }])
      await expect(
        validateContactPersonBelongsToCompany(PERSON_ID, COMPANY_ID_A, em as any),
      ).resolves.toBeUndefined()
    })

    it('throws 422 when contact person does not belong to the company', async () => {
      const em = createValidationEm([])
      await expect(
        validateContactPersonBelongsToCompany(PERSON_ID_OTHER, COMPANY_ID_A, em as any),
      ).rejects.toMatchObject({
        status: 422,
      })
    })
  })

  it('rejects create when contact person does not belong to the company', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    })
    const mockKnex = jest.fn(() => ({
      select: mockSelect,
    }))
    const em = {
      getConnection: () => ({
        getKnex: () => mockKnex,
      }),
    }

    await expect(
      createTicketCommand.execute(
        {
          service_type: 'maintenance',
          customer_entity_id: COMPANY_ID_A,
          contact_person_id: PERSON_ID,
        },
        createCtx({
          dataEngine: { createOrmEntity: jest.fn() },
          em,
        }),
      ),
    ).rejects.toMatchObject({
      status: 422,
    })
  })

  it('rejects create when contact person is set without a company', async () => {
    const em = {
      getConnection: () => ({
        getKnex: () => jest.fn(),
      }),
    }

    await expect(
      createTicketCommand.execute(
        {
          service_type: 'maintenance',
          contact_person_id: PERSON_ID,
        },
        createCtx({
          dataEngine: { createOrmEntity: jest.fn() },
          em,
        }),
      ),
    ).rejects.toMatchObject({
      status: 422,
    })
  })

  it('allows create with company but no contact person', async () => {
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
      },
      createCtx({
        dataEngine: { createOrmEntity },
        em,
      }),
    )

    expect(result).toEqual({ id: TICKET_ID, ticketNumber: 'SRV-000010' })
  })

  it('allows create with neither company nor contact person', async () => {
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
      },
      createCtx({
        dataEngine: { createOrmEntity },
        em,
      }),
    )

    expect(result).toEqual({ id: TICKET_ID, ticketNumber: 'SRV-000010' })
  })

  it('rejects update when contact person does not belong to the new company', async () => {
    const existingTicket = {
      id: TICKET_ID,
      customerEntityId: COMPANY_ID_A,
      contactPersonId: PERSON_ID,
      visitDate: null,
      status: 'new',
    }
    const mockSelect = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    })
    const em = {
      findOne: jest.fn().mockResolvedValue(existingTicket),
      find: jest.fn().mockResolvedValue([]),
      flush: jest.fn().mockResolvedValue(undefined),
      getConnection: () => ({
        getKnex: () => jest.fn(() => ({
          select: mockSelect,
        })),
      }),
    }

    await expect(
      updateTicketCommand.execute(
        {
          id: TICKET_ID,
          customer_entity_id: COMPANY_ID_B,
          contact_person_id: PERSON_ID,
        },
        createCtx({
          dataEngine: {
            updateOrmEntity: jest.fn(),
            createOrmEntity: jest.fn(),
          },
          em,
        }),
      ),
    ).rejects.toMatchObject({
      status: 422,
    })
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
