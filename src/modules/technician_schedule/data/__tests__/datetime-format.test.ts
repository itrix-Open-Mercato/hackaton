/** @jest-environment node */
import { technicianReservationCreateSchema } from '../validators'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

const base = {
  tenantId: VALID_UUID,
  organizationId: VALID_UUID,
  reservationType: 'client_visit' as const,
  technicianIds: [VALID_UUID],
}

describe('Reservation create schema — datetime format from CrudForm', () => {
  it('accepts ISO datetime with Z offset', () => {
    const result = technicianReservationCreateSchema.parse({
      ...base,
      startsAt: '2026-04-12T01:05:00Z',
      endsAt: '2026-04-14T00:00:00Z',
    })
    expect(result.startsAt).toBe('2026-04-12T01:05:00Z')
  })

  it('accepts ISO datetime with explicit offset', () => {
    const result = technicianReservationCreateSchema.parse({
      ...base,
      startsAt: '2026-04-12T01:05:00+02:00',
      endsAt: '2026-04-14T00:00:00+02:00',
    })
    expect(result.startsAt).toBe('2026-04-12T01:05:00+02:00')
  })

  it('FAILS with datetime without offset (CrudForm sends this — route normalizes it)', () => {
    // CrudForm datetime fields produce "2026-04-12T01:05" without Z offset
    // The raw schema rejects this — the route's normalizeDatetimeFields fixes it before parsing
    expect(() => technicianReservationCreateSchema.parse({
      ...base,
      startsAt: '2026-04-12T01:05',
      endsAt: '2026-04-14T00:00',
    })).toThrow()
  })

  it('normalization helper appends Z to offset-less datetimes', () => {
    // Inline the same logic used in the route
    function ensureDatetimeOffset(value: string): string {
      if (/[Zz]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) return value
      return value + 'Z'
    }

    expect(ensureDatetimeOffset('2026-04-12T01:05')).toBe('2026-04-12T01:05Z')
    expect(ensureDatetimeOffset('2026-04-12T01:05:00Z')).toBe('2026-04-12T01:05:00Z')
    expect(ensureDatetimeOffset('2026-04-12T01:05:00+02:00')).toBe('2026-04-12T01:05:00+02:00')

    // After normalization, the schema should accept
    const result = technicianReservationCreateSchema.parse({
      ...base,
      startsAt: ensureDatetimeOffset('2026-04-12T01:05'),
      endsAt: ensureDatetimeOffset('2026-04-14T00:00'),
    })
    expect(result.startsAt).toBe('2026-04-12T01:05Z')
  })

  it('FAILS with datetime without seconds and offset', () => {
    expect(() => technicianReservationCreateSchema.parse({
      ...base,
      startsAt: '2026-04-12 01:05',
      endsAt: '2026-04-14 00:00',
    })).toThrow()
  })

  it('FAILS with date-only string', () => {
    expect(() => technicianReservationCreateSchema.parse({
      ...base,
      startsAt: '2026-04-12',
      endsAt: '2026-04-14',
    })).toThrow()
  })
})
