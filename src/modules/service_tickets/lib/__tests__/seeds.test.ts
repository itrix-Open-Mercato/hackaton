/**
 * @jest-environment node
 */
import { seedServiceTicketExamples, dateFromDayOffset } from '../seeds'

const SCOPE = { tenantId: 'tenant-1', organizationId: 'org-1' }

function createMockKnex(tableData: Record<string, Record<string, unknown>[]> = {}) {
  const knexFn = (table: string) => {
    const rows = tableData[table] ?? []
    const chain = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(rows),
    }
    // For chained calls that end without limit (whereIn → andWhere → then)
    chain.andWhere = jest.fn().mockResolvedValue(rows)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.whereIn = jest.fn().mockReturnValue(chain)
    return chain
  }
  return knexFn
}

function createMockEm(options: { existingCount?: number; knex?: ReturnType<typeof createMockKnex> } = {}) {
  const created: { entity: string; data: Record<string, unknown> }[] = []
  const persisted: unknown[] = []

  const em: any = {
    count: jest.fn().mockResolvedValue(options.existingCount ?? 0),
    create: jest.fn((entityClass: { name: string }, data: Record<string, unknown>) => {
      const record = { id: `mock-${entityClass.name}-${created.length}`, ...data }
      created.push({ entity: entityClass.name, data: record })
      return record
    }),
    persist: jest.fn((entity: unknown) => {
      persisted.push(entity)
      return em
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockReturnValue({
      getKnex: jest.fn().mockReturnValue(options.knex ?? createMockKnex()),
    }),
  }

  return { em, created, persisted }
}

describe('dateFromDayOffset', () => {
  it('returns a date offset by the given number of days, normalized to 09:00', () => {
    const now = new Date()
    const result = dateFromDayOffset(5)

    const expected = new Date()
    expected.setDate(expected.getDate() + 5)
    expected.setHours(9, 0, 0, 0)

    expect(result.getFullYear()).toBe(expected.getFullYear())
    expect(result.getMonth()).toBe(expected.getMonth())
    expect(result.getDate()).toBe(expected.getDate())
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })

  it('handles negative offsets', () => {
    const result = dateFromDayOffset(-14)

    const expected = new Date()
    expected.setDate(expected.getDate() - 14)

    expect(result.getDate()).toBe(expected.getDate())
    expect(result.getHours()).toBe(9)
  })
})

describe('seedServiceTicketExamples', () => {
  it('skips seeding when tickets already exist (idempotency)', async () => {
    const { em } = createMockEm({ existingCount: 3 })

    await seedServiceTicketExamples(em, SCOPE)

    expect(em.count).toHaveBeenCalledTimes(1)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('creates 8 tickets when none exist', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    const tickets = created.filter((c) => c.entity === 'ServiceTicket')
    expect(tickets).toHaveLength(8)
    expect(em.flush).toHaveBeenCalledTimes(1)
  })

  it('creates tickets with correct ticket numbers', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    const ticketNumbers = created
      .filter((c) => c.entity === 'ServiceTicket')
      .map((c) => c.data.ticketNumber)
    expect(ticketNumbers).toEqual([
      'SRV-000001', 'SRV-000002', 'SRV-000003', 'SRV-000004',
      'SRV-000005', 'SRV-000006', 'SRV-000007', 'SRV-000008',
    ])
  })

  it('covers all statuses', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    const statuses = new Set(
      created.filter((c) => c.entity === 'ServiceTicket').map((c) => c.data.status),
    )
    expect(statuses).toContain('new')
    expect(statuses).toContain('scheduled')
    expect(statuses).toContain('in_progress')
    expect(statuses).toContain('completed')
    expect(statuses).toContain('cancelled')
  })

  it('covers all service types', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    const types = new Set(
      created.filter((c) => c.entity === 'ServiceTicket').map((c) => c.data.serviceType),
    )
    expect(types).toContain('commissioning')
    expect(types).toContain('regular')
    expect(types).toContain('warranty_claim')
    expect(types).toContain('maintenance')
  })

  it('handles missing cross-module entities gracefully', async () => {
    // No customer/staff/product data in Knex — all lookups return empty
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    // Tickets are still created
    const tickets = created.filter((c) => c.entity === 'ServiceTicket')
    expect(tickets).toHaveLength(8)

    // customerEntityId resolves to null when customer not found
    expect(tickets[0].data.customerEntityId).toBeNull()

    // No assignments or parts created (staff/products not found)
    const assignments = created.filter((c) => c.entity === 'ServiceTicketAssignment')
    expect(assignments).toHaveLength(0)

    const parts = created.filter((c) => c.entity === 'ServiceTicketPart')
    expect(parts).toHaveLength(0)
  })

  it('creates assignments when staff members are found', async () => {
    const knex = createMockKnex({
      staff_team_members: [
        { id: 'staff-jan', display_name: 'Jan Kowalski' },
        { id: 'staff-anna', display_name: 'Anna Nowak' },
      ],
    })
    const { em, created } = createMockEm({ knex })

    await seedServiceTicketExamples(em, SCOPE)

    const assignments = created.filter((c) => c.entity === 'ServiceTicketAssignment')
    // SRV-2: Jan, SRV-3: Jan, SRV-4: Anna, SRV-6: Jan+Anna, SRV-8: Anna = 6 assignments
    expect(assignments).toHaveLength(6)
  })

  it('creates parts when products are found', async () => {
    const knex = createMockKnex({
      catalog_products: [
        { id: 'prod-atlas', sku: 'ATLAS-RUNNER' },
        { id: 'prod-summit', sku: 'SUMMIT-PRO' },
      ],
    })
    const { em, created } = createMockEm({ knex })

    await seedServiceTicketExamples(em, SCOPE)

    const parts = created.filter((c) => c.entity === 'ServiceTicketPart')
    // SRV-2: 1, SRV-3: 2, SRV-4: 1, SRV-6: 1, SRV-8: 2 = 7 parts
    expect(parts).toHaveLength(7)
  })

  it('creates date change records', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    const dateChanges = created.filter((c) => c.entity === 'ServiceTicketDateChange')
    // SRV-3: 1, SRV-6: 1, SRV-8: 2 = 4 date changes
    expect(dateChanges).toHaveLength(4)
  })

  it('sets tenantId and organizationId on all created entities', async () => {
    const { em, created } = createMockEm()

    await seedServiceTicketExamples(em, SCOPE)

    for (const c of created) {
      expect(c.data.tenantId).toBe(SCOPE.tenantId)
      expect(c.data.organizationId).toBe(SCOPE.organizationId)
    }
  })
})
