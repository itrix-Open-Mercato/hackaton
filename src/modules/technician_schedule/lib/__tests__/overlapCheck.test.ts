/** @jest-environment node */
import { checkReservationOverlap } from '../overlapCheck'

const TECH_A = 'aaaa0000-0000-4000-8000-000000000001'
const TECH_B = 'bbbb0000-0000-4000-8000-000000000002'
const RES_1 = 'rrrr0000-0000-4000-8000-000000000001'

function createMockEm(rows: Array<{ technician_id: string }>) {
  const executeFn = jest.fn().mockResolvedValue(rows)
  const connection = { execute: executeFn }
  return {
    getConnection: () => connection,
    _execute: executeFn,
  } as any
}

const baseInput = {
  tenantId: 't1',
  organizationId: 'o1',
  startsAt: new Date('2026-06-01T09:00:00Z'),
  endsAt: new Date('2026-06-01T11:00:00Z'),
}

describe('checkReservationOverlap', () => {
  it('detects overlap for same technician in overlapping window', async () => {
    const em = createMockEm([{ technician_id: TECH_A }])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A],
      startsAt: new Date('2026-06-01T10:00:00Z'),
      endsAt: new Date('2026-06-01T12:00:00Z'),
    })
    expect(result.hasConflict).toBe(true)
    expect(result.conflictingTechnicianIds).toEqual([TECH_A])
  })

  it('returns no overlap for adjacent time windows', async () => {
    const em = createMockEm([])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A],
      startsAt: new Date('2026-06-01T11:00:00Z'),
      endsAt: new Date('2026-06-01T13:00:00Z'),
    })
    expect(result.hasConflict).toBe(false)
    expect(result.conflictingTechnicianIds).toEqual([])
  })

  it('returns no overlap for different technician', async () => {
    const em = createMockEm([])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_B],
    })
    expect(result.hasConflict).toBe(false)
    expect(result.conflictingTechnicianIds).toEqual([])
  })

  it('excludes cancelled reservations from overlap check', async () => {
    // The SQL has `tr.status <> 'cancelled'`, so the DB returns empty for cancelled
    const em = createMockEm([])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A],
    })
    expect(result.hasConflict).toBe(false)
  })

  it('excludes specified reservation from overlap (self-update)', async () => {
    const em = createMockEm([])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A],
      excludeReservationId: RES_1,
    })
    expect(result.hasConflict).toBe(false)

    // Verify the SQL includes excludeReservationId
    const execute = em._execute
    expect(execute).toHaveBeenCalledTimes(1)
    const [sql, params] = execute.mock.calls[0]
    expect(sql).toContain('tr.id <> ?')
    expect(params).toContain(RES_1)
  })

  it('reports multiple technicians with partial conflict', async () => {
    // Only TECH_A conflicts, TECH_B is free
    const em = createMockEm([{ technician_id: TECH_A }])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A, TECH_B],
    })
    expect(result.hasConflict).toBe(true)
    expect(result.conflictingTechnicianIds).toEqual([TECH_A])
    expect(result.conflictingTechnicianIds).not.toContain(TECH_B)
  })

  it('returns no conflict for empty technicianIds', async () => {
    const em = createMockEm([])
    const result = await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [],
    })
    expect(result.hasConflict).toBe(false)
    expect(result.conflictingTechnicianIds).toEqual([])
    // Should not even call the DB
    expect(em._execute).not.toHaveBeenCalled()
  })

  it('deduplicates technicianIds', async () => {
    const em = createMockEm([])
    await checkReservationOverlap(em, {
      ...baseInput,
      technicianIds: [TECH_A, TECH_A, TECH_A],
    })
    const [sql] = em._execute.mock.calls[0]
    // Should have only one placeholder for deduplicated IDs
    const placeholderMatch = sql.match(/in \(([^)]+)\)/)?.[1] ?? ''
    expect(placeholderMatch.split(',').map((s: string) => s.trim())).toEqual(['?'])
  })
})
