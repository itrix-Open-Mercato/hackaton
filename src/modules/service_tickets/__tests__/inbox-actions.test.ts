import { isFreemailDomain, extractDomain, assembleConfidence } from '../inbox-actions'

// Re-export the normalizePayload through the inboxActions array
import { inboxActions } from '../inbox-actions'

const normalizePayload = inboxActions[0].normalizePayload!

// --- Knex mock builder ---

function createKnexMock(tables: Record<string, any[]>) {
  const createChain = (tableName: string) => {
    let rows = [...(tables[tableName] ?? [])]
    let joinedTable: string | null = null
    let selectFields: string[] = []

    const chain: any = {
      select: (...fields: string[]) => { selectFields = fields; return chain },
      where: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] === val)
        return chain
      },
      whereRaw: (_sql: string, params: any[]) => {
        // Simulate ILIKE for email matching
        const lowerParam = String(params[0]).toLowerCase()
        rows = rows.filter((r) => {
          // Check common email/domain fields
          if (r.primary_email && String(r.primary_email).toLowerCase() === lowerParam) return true
          if (r.domain && String(r.domain).toLowerCase() === lowerParam) return true
          return false
        })
        return chain
      },
      whereNull: (col: string) => {
        rows = rows.filter((r) => r[col] == null)
        return chain
      },
      whereIn: (col: string, vals: any[]) => {
        rows = rows.filter((r) => vals.includes(r[col]))
        return chain
      },
      join: (table: string, left: string, right: string) => {
        joinedTable = table
        const joinRows = tables[table] ?? []
        const leftCol = left.split('.').pop()!
        const rightCol = right.split('.').pop()!
        const joined: any[] = []
        for (const r of rows) {
          for (const jr of joinRows) {
            if (r[leftCol] === jr[rightCol] || jr[leftCol] === r[rightCol]) {
              joined.push({ ...r, ...jr })
            }
          }
        }
        rows = joined
        return chain
      },
      first: () => Promise.resolve(rows[0] ?? null),
      then: (resolve: any) => resolve(rows),
    }
    return chain
  }

  return (tableName: string) => createChain(tableName)
}

function createCtx(knex: any, organizationId = 'org-1') {
  return {
    em: {},
    userId: 'user-1',
    tenantId: 'tenant-1',
    organizationId,
    container: { resolve: (key: string) => key === 'knex' ? knex : undefined },
    executeCommand: async () => ({}),
    resolveEntityClass: () => null,
  } as any
}

// ============================================
// 10. Tests — Freemail & Domain Utilities
// ============================================

describe('isFreemailDomain', () => {
  // 10.1
  it.each(['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'live.com', 'aol.com'])(
    'returns true for %s',
    (domain) => { expect(isFreemailDomain(domain)).toBe(true) },
  )

  // 10.2
  it.each(['acme.com', 'example.org'])(
    'returns false for %s',
    (domain) => { expect(isFreemailDomain(domain)).toBe(false) },
  )
})

describe('extractDomain', () => {
  // 10.3
  it('extracts domain from standard email', () => {
    expect(extractDomain('user@acme.com')).toBe('acme.com')
  })

  // 10.4
  it('handles uppercase and plus-addressing', () => {
    expect(extractDomain('User+tag@ACME.COM')).toBe('acme.com')
  })
})

// ============================================
// 9. Tests — Confidence Assembly
// ============================================

describe('assembleConfidence', () => {
  // 9.1
  it('caps at 1.0 for high confidence', () => {
    expect(assembleConfidence(0.9, 0.3 + 0.25)).toBe(1.0)
  })

  // 9.2
  it('computes low confidence with no matching signals', () => {
    expect(assembleConfidence(0.6, 0)).toBeCloseTo(0.3)
  })

  // 9.3
  it('computes medium confidence with domain match', () => {
    expect(assembleConfidence(0.7, 0.15)).toBeCloseTo(0.5)
  })

  // 9.4
  it('never exceeds 1.0', () => {
    expect(assembleConfidence(1.0, 1.0)).toBe(1.0)
  })

  // 9.5 — confidence stored as _confidence (tested via normalizePayload)
  // 9.6 — confidence does not gate visibility (design decision, no code to test)
})

// ============================================
// 7. Tests — Customer Resolution
// ============================================

describe('customer resolution via normalizePayload', () => {
  // 7.1
  it('exact email match sets customer_entity_id and _customer_name, adds +0.3 confidence', async () => {
    const knex = createKnexMock({
      customer_entities: [
        { id: 'cust-1', primary_email: 'user@acme.com', display_name: 'Acme Corp', organization_id: 'org-1', deleted_at: null },
      ],
    })
    const ctx = createCtx(knex)
    const result = await normalizePayload({ description: 'test', customer_email: 'user@acme.com', _llm_confidence: 0.8 }, ctx)
    expect(result.customer_entity_id).toBe('cust-1')
    expect(result._customer_name).toBe('Acme Corp')
    expect(result._confidence).toBeCloseTo(0.8 * 0.5 + 0.3) // 0.7
  })

  // 7.2
  it('exact email match is case-insensitive', async () => {
    const knex = createKnexMock({
      customer_entities: [
        { id: 'cust-1', primary_email: 'user@acme.com', display_name: 'Acme Corp', organization_id: 'org-1', deleted_at: null },
      ],
    })
    const ctx = createCtx(knex)
    const result = await normalizePayload({ description: 'test', customer_email: 'User@Acme.COM', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBe('cust-1')
  })

  // 7.3
  it('domain match with single result sets customer_entity_id, adds +0.15 confidence', async () => {
    const knex = createKnexMock({
      customer_entities: [],
      customer_companies: [
        { id: 'comp-1', domain: 'acme.com' },
      ],
      // Joined result:
    })
    // Override knex to handle the join scenario
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        return {
          // Domain matching path (join)
          join: () => ({
            select: () => ({
              whereRaw: () => ({
                where: () => ({
                  whereNull: () => ({
                    then: (resolve: any) => resolve([
                      { id: 'cust-2', display_name: 'Acme Subsidiary' },
                    ]),
                  }),
                }),
              }),
            }),
          }),
          // Company ID lookup path (select/where/first) — for machine resolution
          select: () => ({
            where: () => ({
              first: () => Promise.resolve({ id: 'comp-2' }),
            }),
          }),
        }
      }
      if (table === 'machine_instances') {
        const chain: any = {}
        chain.select = () => chain
        chain.where = () => chain
        chain.then = (resolve: any) => resolve([])
        return chain
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'someone@acme.com', _llm_confidence: 0.7 }, ctx)
    expect(result.customer_entity_id).toBe('cust-2')
    expect(result._confidence).toBeCloseTo(0.7 * 0.5 + 0.15) // 0.5
  })

  // 7.4
  it('domain match with multiple results does NOT set customer_entity_id, adds ambiguous_customer discrepancy', async () => {
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        return {
          join: () => ({
            select: () => ({
              whereRaw: () => ({
                where: () => ({
                  whereNull: () => ({
                    then: (resolve: any) => resolve([
                      { id: 'cust-a', display_name: 'Acme A' },
                      { id: 'cust-b', display_name: 'Acme B' },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'user@acme.com', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBeUndefined()
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'ambiguous_customer')).toBe(true)
  })

  // 7.5
  it('freemail domains skip domain matching', async () => {
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      // customer_companies should NOT be called
      if (table === 'customer_companies') {
        throw new Error('Should not query customer_companies for freemail domain')
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'user@gmail.com', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBeUndefined()
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'unknown_contact')).toBe(true)
  })

  // 7.6
  it('no match adds unknown_contact discrepancy', async () => {
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        return {
          join: () => ({
            select: () => ({
              whereRaw: () => ({
                where: () => ({
                  whereNull: () => ({
                    then: (resolve: any) => resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'nobody@unknown.org', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBeUndefined()
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'unknown_contact')).toBe(true)
  })

  // 7.7
  it('exact match takes priority over domain match (domain query not attempted)', async () => {
    const domainQueried = { value: false }
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve({ id: 'cust-exact', display_name: 'Exact Match' }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        // customer_companies IS queried during machine resolution (to get company_id),
        // but domain matching should NOT be attempted when exact email matched.
        // We track domain queries by checking if join was called.
        return {
          select: () => ({
            where: () => ({
              first: () => Promise.resolve({ id: 'comp-1' }),
            }),
          }),
          join: () => {
            domainQueried.value = true
            return createKnexMock({})(table)
          },
        }
      }
      if (table === 'machine_instances') {
        const chain: any = {}
        chain.select = () => chain
        chain.where = () => chain
        chain.then = (resolve: any) => resolve([])
        return chain
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'user@acme.com', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBe('cust-exact')
    expect(domainQueried.value).toBe(false)
  })

  // 7.8
  it('deleted customers are excluded', async () => {
    const knex = createKnexMock({
      customer_entities: [
        { id: 'cust-del', primary_email: 'user@acme.com', display_name: 'Deleted', organization_id: 'org-1', deleted_at: new Date() },
      ],
    })
    const ctx = createCtx(knex)
    // The whereNull('deleted_at') filter excludes the deleted customer
    const result = await normalizePayload({ description: 'test', customer_email: 'user@acme.com', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBeUndefined()
  })

  // 7.9
  it('customers from other organizations are excluded', async () => {
    const knex = createKnexMock({
      customer_entities: [
        { id: 'cust-other', primary_email: 'user@acme.com', display_name: 'Other Org', organization_id: 'org-other', deleted_at: null },
      ],
    })
    const ctx = createCtx(knex) // org-1
    const result = await normalizePayload({ description: 'test', customer_email: 'user@acme.com', _llm_confidence: 0.5 }, ctx)
    expect(result.customer_entity_id).toBeUndefined()
  })
})

// ============================================
// 8. Tests — Machine Resolution
// ============================================

describe('machine resolution via normalizePayload', () => {
  function machineKnex(
    customerMatch: any,
    machines: any[],
    catalogProfiles: any[] = [],
    companyId = 'comp-1',
  ) {
    return (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(customerMatch),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        // Resolve entity_id → company_id
        const chain: any = {}
        chain.select = () => chain
        chain.where = () => chain
        chain.first = () => Promise.resolve(customerMatch ? { id: companyId } : null)
        return chain
      }
      if (table === 'machine_instances') {
        let rows = [...machines]
        const chain: any = {}
        chain.select = () => chain
        chain.where = (col: string, val: any) => {
          const field = col.includes('.') ? col.split('.').pop()! : col
          rows = rows.filter((r) => r[field] === val)
          return chain
        }
        chain.then = (resolve: any) => resolve(rows)
        return chain
      }
      if (table === 'machine_catalog_profiles') {
        let rows = [...catalogProfiles]
        const chain: any = {}
        chain.select = () => chain
        chain.whereIn = (col: string, vals: any[]) => {
          rows = rows.filter((r) => vals.includes(r[col]))
          return chain
        }
        chain.then = (resolve: any) => resolve(rows)
        return chain
      }
      return createKnexMock({})(table)
    }
  }

  const customer = { id: 'cust-1', display_name: 'Acme Corp' }

  // 8.1
  it('exact serial_number match sets machine_instance_id, adds +0.25 confidence', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-1', serial_number: 'SN-12345', instance_code: 'IC-001', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'CNC 6000', catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['SN-12345'],
      _llm_confidence: 0.8,
    }, ctx)
    expect(result.machine_instance_id).toBe('mach-1')
    expect(result._machine_label).toBe('IC-001 (SN-12345)')
    // confidence = 0.8*0.5 + 0.3 (customer) + 0.25 (machine) = 0.95
    expect(result._confidence).toBeCloseTo(0.95)
  })

  // 8.2
  it('exact instance_code match sets machine_instance_id, adds +0.25 confidence', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-2', serial_number: 'SN-99', instance_code: 'IC-001', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: null, catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['IC-001'],
      _llm_confidence: 0.6,
    }, ctx)
    expect(result.machine_instance_id).toBe('mach-2')
  })

  // 8.3
  it('fuzzy catalog match with one machine sets machine_instance_id, adds +0.1 confidence', async () => {
    const knex = machineKnex(
      customer,
      [
        { id: 'mach-3', serial_number: 'SN-X', instance_code: 'IC-X', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'HP TM25', catalog_product_id: 'cat-1' },
      ],
      [{ id: 'cat-1', model_code: 'TM25', machine_family: 'TurboMill' }],
    )
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['TM25'],
      _llm_confidence: 0.7,
    }, ctx)
    expect(result.machine_instance_id).toBe('mach-3')
    expect(result._confidence).toBeCloseTo(0.7 * 0.5 + 0.3 + 0.1) // 0.75
  })

  // 8.4
  it('fuzzy catalog match with multiple machines does NOT auto-resolve, adds machine_not_found', async () => {
    const knex = machineKnex(
      customer,
      [
        { id: 'mach-a', serial_number: 'SN-A', instance_code: 'IC-A', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'Machine A', catalog_product_id: 'cat-1' },
        { id: 'mach-b', serial_number: 'SN-B', instance_code: 'IC-B', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'Machine B', catalog_product_id: 'cat-1' },
      ],
      [{ id: 'cat-1', model_code: 'TM25', machine_family: 'TurboMill' }],
    )
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['TM25'],
      _llm_confidence: 0.5,
    }, ctx)
    expect(result.machine_instance_id).toBeUndefined()
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'machine_not_found')).toBe(true)
  })

  // 8.5
  it('no hint matches any customer machine -> machine_not_found discrepancy', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-1', serial_number: 'SN-1', instance_code: 'IC-1', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'M1', catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['NOPE-999'],
      _llm_confidence: 0.5,
    }, ctx)
    expect(result.machine_instance_id).toBeUndefined()
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'machine_not_found')).toBe(true)
  })

  // 8.6
  it('single-machine customer with no hints auto-suggests, adds +0.05', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-only', serial_number: 'SN-ONLY', instance_code: 'IC-ONLY', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'Only Machine', catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      _llm_confidence: 0.5,
    }, ctx)
    expect(result.machine_instance_id).toBe('mach-only')
    expect(result._confidence).toBeCloseTo(0.5 * 0.5 + 0.3 + 0.05) // 0.6
  })

  // 8.7
  it('single-machine customer WITH hints does NOT auto-suggest', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-only', serial_number: 'SN-ONLY', instance_code: 'IC-ONLY', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: true, site_name: 'Only Machine', catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['WRONG-HINT'],
      _llm_confidence: 0.5,
    }, ctx)
    // Hint doesn't match serial or instance_code, so machine_not_found
    const discrepancies = result._discrepancies as any[]
    expect(discrepancies.some((d: any) => d.type === 'machine_not_found')).toBe(true)
  })

  // 8.8
  it('machine resolution skipped when customer_entity_id is empty', async () => {
    const machinesQueried = { value: false }
    const companiesForMachineQueried = { value: false }
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        // Domain matching (join path) — returns no results
        return {
          join: () => ({
            select: () => ({
              whereRaw: () => ({
                where: () => ({
                  whereNull: () => ({
                    then: (resolve: any) => resolve([]),
                  }),
                }),
              }),
            }),
          }),
          // company_id lookup (select/where/first path) — should NOT be called
          select: () => {
            companiesForMachineQueried.value = true
            return { where: () => ({ first: () => Promise.resolve(null) }) }
          },
        }
      }
      if (table === 'machine_instances') {
        machinesQueried.value = true
        return createKnexMock({})(table)
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    await normalizePayload({
      description: 'test',
      customer_email: 'nobody@unknowncorp.com',
      machine_hints: ['SN-123'],
      _llm_confidence: 0.5,
    }, ctx)
    expect(machinesQueried.value).toBe(false)
    expect(companiesForMachineQueried.value).toBe(false)
  })

  // 8.9
  it('inactive machines are excluded', async () => {
    const knex = machineKnex(customer, [
      { id: 'mach-inactive', serial_number: 'SN-12345', instance_code: 'IC-001', customer_company_id: 'comp-1', organization_id: 'org-1', is_active: false, site_name: 'Deactivated', catalog_product_id: null },
    ])
    const ctx = createCtx(knex)
    const result = await normalizePayload({
      description: 'test',
      customer_email: 'user@acme.com',
      machine_hints: ['SN-12345'],
      _llm_confidence: 0.5,
    }, ctx)
    // Machine is filtered out by is_active=true, so no match
    expect(result.machine_instance_id).toBeUndefined()
  })
})

// Confidence stored as _confidence (9.5)
describe('confidence in normalized payload', () => {
  it('stores confidence as _confidence', async () => {
    const mockKnex = (table: string) => {
      if (table === 'customer_entities') {
        return {
          select: () => ({
            whereRaw: () => ({
              where: () => ({
                whereNull: () => ({
                  first: () => Promise.resolve(null),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'customer_companies') {
        return {
          join: () => ({
            select: () => ({
              whereRaw: () => ({
                where: () => ({
                  whereNull: () => ({
                    then: (resolve: any) => resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return createKnexMock({})(table)
    }
    const ctx = createCtx(mockKnex)
    const result = await normalizePayload({ description: 'test', customer_email: 'user@nowhere.org', _llm_confidence: 0.6 }, ctx)
    expect(typeof result._confidence).toBe('number')
    expect(result._confidence).toBeCloseTo(0.3)
  })
})
