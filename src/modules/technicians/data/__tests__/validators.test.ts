/**
 * @jest-environment node
 */
import {
  technicianCreateSchema,
  technicianUpdateSchema,
  skillAddSchema,
  skillRemoveSchema,
  certificationAddSchema,
  certificationUpdateSchema,
  certificationRemoveSchema,
} from '../validators'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('technicianCreateSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = technicianCreateSchema.parse({
      staff_member_id: VALID_UUID,
      is_active: true,
      notes: 'Senior electrician',
      skills: ['Electrical', 'HVAC'],
      certifications: [
        { name: 'ISO 9001', certificate_number: 'ABC-123', issued_at: '2025-01-01', expires_at: '2026-01-01' },
      ],
    })
    expect(result.staff_member_id).toBe(VALID_UUID)
    expect(result.skills).toEqual(['Electrical', 'HVAC'])
    expect(result.certifications).toHaveLength(1)
  })

  it('accepts minimal input with only staff_member_id', () => {
    const result = technicianCreateSchema.parse({ staff_member_id: VALID_UUID })
    expect(result.staff_member_id).toBe(VALID_UUID)
    expect(result.is_active).toBe(true)
    expect(result.skills).toBeUndefined()
    expect(result.certifications).toBeUndefined()
  })

  it('rejects invalid UUID for staff_member_id', () => {
    expect(() =>
      technicianCreateSchema.parse({ staff_member_id: 'not-a-uuid' }),
    ).toThrow()
  })

  it('rejects missing staff_member_id', () => {
    expect(() => technicianCreateSchema.parse({})).toThrow()
  })

  it('coerces boolean is_active', () => {
    const result = technicianCreateSchema.parse({
      staff_member_id: VALID_UUID,
      is_active: false,
    })
    expect(result.is_active).toBe(false)
  })

  it('converts empty notes to undefined', () => {
    const result = technicianCreateSchema.parse({
      staff_member_id: VALID_UUID,
      notes: '',
    })
    expect(result.notes).toBeUndefined()
  })

  it('rejects empty skill names', () => {
    expect(() =>
      technicianCreateSchema.parse({
        staff_member_id: VALID_UUID,
        skills: [''],
      }),
    ).toThrow()
  })

  it('rejects certification with empty name', () => {
    expect(() =>
      technicianCreateSchema.parse({
        staff_member_id: VALID_UUID,
        certifications: [{ name: '' }],
      }),
    ).toThrow()
  })
})

describe('technicianUpdateSchema', () => {
  it('accepts valid update', () => {
    const result = technicianUpdateSchema.parse({ id: VALID_UUID, is_active: false })
    expect(result.id).toBe(VALID_UUID)
    expect(result.is_active).toBe(false)
  })

  it('rejects missing id', () => {
    expect(() => technicianUpdateSchema.parse({ is_active: true })).toThrow()
  })

  it('allows nullable notes', () => {
    const result = technicianUpdateSchema.parse({ id: VALID_UUID, notes: '' })
    expect(result.notes).toBeNull()
  })
})

describe('skillAddSchema', () => {
  it('accepts valid input', () => {
    const result = skillAddSchema.parse({ technician_id: VALID_UUID, name: 'Electrical' })
    expect(result.name).toBe('Electrical')
  })

  it('rejects empty name', () => {
    expect(() => skillAddSchema.parse({ technician_id: VALID_UUID, name: '' })).toThrow()
  })

  it('rejects invalid technician_id', () => {
    expect(() => skillAddSchema.parse({ technician_id: 'bad', name: 'Skill' })).toThrow()
  })
})

describe('skillRemoveSchema', () => {
  it('accepts valid UUID', () => {
    const result = skillRemoveSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('rejects invalid id', () => {
    expect(() => skillRemoveSchema.parse({ id: 'bad' })).toThrow()
  })
})

describe('certificationAddSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = certificationAddSchema.parse({
      technician_id: VALID_UUID,
      name: 'ISO 9001',
      certificate_number: 'CERT-001',
      issued_at: '2025-01-01',
      expires_at: '2026-12-31',
    })
    expect(result.name).toBe('ISO 9001')
    expect(result.certificate_number).toBe('CERT-001')
  })

  it('accepts minimal input', () => {
    const result = certificationAddSchema.parse({
      technician_id: VALID_UUID,
      name: 'Safety Training',
    })
    expect(result.name).toBe('Safety Training')
  })

  it('rejects empty name', () => {
    expect(() =>
      certificationAddSchema.parse({ technician_id: VALID_UUID, name: '' }),
    ).toThrow()
  })
})

describe('certificationUpdateSchema', () => {
  it('accepts valid update', () => {
    const result = certificationUpdateSchema.parse({
      id: VALID_UUID,
      name: 'Updated Cert',
      expires_at: '2027-01-01',
    })
    expect(result.name).toBe('Updated Cert')
  })

  it('allows clearing optional fields', () => {
    const result = certificationUpdateSchema.parse({
      id: VALID_UUID,
      certificate_number: '',
    })
    expect(result.certificate_number).toBeNull()
  })
})

describe('certificationRemoveSchema', () => {
  it('accepts valid UUID', () => {
    const result = certificationRemoveSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })
})
