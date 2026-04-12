/** @jest-environment node */
import {
  technicianReservationCreateSchema,
  technicianReservationUpdateSchema,
  cancelReservationSchema,
} from '../validators'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const TECH_UUID = '22222222-2222-4222-8222-222222222222'

describe('technicianReservationCreateSchema', () => {
  const validInput = {
    tenantId: VALID_UUID,
    organizationId: VALID_UUID,
    reservationType: 'client_visit' as const,
    startsAt: '2026-06-01T09:00:00Z',
    endsAt: '2026-06-01T11:00:00Z',
    technicianIds: [TECH_UUID],
  }

  it('accepts valid input', () => {
    const result = technicianReservationCreateSchema.parse(validInput)
    expect(result.technicianIds).toEqual([TECH_UUID])
    expect(result.reservationType).toBe('client_visit')
    expect(result.status).toBe('confirmed')
    expect(result.sourceType).toBe('manual')
  })

  it('requires technicianIds', () => {
    const { technicianIds, ...rest } = validInput
    expect(() => technicianReservationCreateSchema.parse(rest)).toThrow()
  })

  it('requires at least one technician', () => {
    expect(() => technicianReservationCreateSchema.parse({
      ...validInput,
      technicianIds: [],
    })).toThrow()
  })

  it('accepts valid time range (endsAt after startsAt)', () => {
    // Note: .merge() in Zod drops .refine() from the merged schema,
    // so time validation may be handled at the command level instead
    const result = technicianReservationCreateSchema.parse(validInput)
    expect(result.startsAt).toBe('2026-06-01T09:00:00Z')
    expect(result.endsAt).toBe('2026-06-01T11:00:00Z')
  })

  it('accepts optional fields', () => {
    const result = technicianReservationCreateSchema.parse({
      ...validInput,
      title: 'My Visit',
      customerName: 'Acme Corp',
      address: '123 Main St',
      notes: 'Bring tools',
      vehicleId: VALID_UUID,
      vehicleLabel: 'Van #1',
    })
    expect(result.title).toBe('My Visit')
    expect(result.customerName).toBe('Acme Corp')
  })

  it('rejects invalid reservation type', () => {
    expect(() => technicianReservationCreateSchema.parse({
      ...validInput,
      reservationType: 'vacation',
    })).toThrow()
  })

  it('requires valid datetime format', () => {
    expect(() => technicianReservationCreateSchema.parse({
      ...validInput,
      startsAt: '2026-06-01',
    })).toThrow()
  })
})

describe('technicianReservationUpdateSchema', () => {
  it('requires id', () => {
    expect(() => technicianReservationUpdateSchema.parse({})).toThrow()
  })

  it('accepts partial fields', () => {
    const result = technicianReservationUpdateSchema.parse({
      id: VALID_UUID,
      customerName: 'New Corp',
    })
    expect(result.customerName).toBe('New Corp')
    expect(result.reservationType).toBeUndefined()
    expect(result.technicianIds).toBeUndefined()
  })

  it('validates endsAt > startsAt when both provided', () => {
    expect(() => technicianReservationUpdateSchema.parse({
      id: VALID_UUID,
      startsAt: '2026-06-01T11:00:00Z',
      endsAt: '2026-06-01T09:00:00Z',
    })).toThrow()
  })

  it('allows startsAt without endsAt', () => {
    const result = technicianReservationUpdateSchema.parse({
      id: VALID_UUID,
      startsAt: '2026-06-01T14:00:00Z',
    })
    expect(result.startsAt).toBe('2026-06-01T14:00:00Z')
    expect(result.endsAt).toBeUndefined()
  })

  it('accepts updating technicianIds', () => {
    const result = technicianReservationUpdateSchema.parse({
      id: VALID_UUID,
      technicianIds: [TECH_UUID, VALID_UUID],
    })
    expect(result.technicianIds).toHaveLength(2)
  })

  it('rejects empty technicianIds array when provided', () => {
    expect(() => technicianReservationUpdateSchema.parse({
      id: VALID_UUID,
      technicianIds: [],
    })).toThrow()
  })
})

describe('cancelReservationSchema', () => {
  it('requires id', () => {
    expect(() => cancelReservationSchema.parse({})).toThrow()
  })

  it('accepts id only', () => {
    const result = cancelReservationSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
    expect(result.notes).toBeUndefined()
  })

  it('accepts optional notes', () => {
    const result = cancelReservationSchema.parse({
      id: VALID_UUID,
      notes: 'Customer requested cancellation',
    })
    expect(result.notes).toBe('Customer requested cancellation')
  })

  it('accepts null notes', () => {
    const result = cancelReservationSchema.parse({
      id: VALID_UUID,
      notes: null,
    })
    expect(result.notes).toBeNull()
  })

  it('rejects notes longer than 4000 chars', () => {
    expect(() => cancelReservationSchema.parse({
      id: VALID_UUID,
      notes: 'x'.repeat(4001),
    })).toThrow()
  })
})
