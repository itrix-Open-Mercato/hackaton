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
  locationStatusSchema,
  availabilityDayTypeSchema,
  availabilityCreateSchema,
  availabilityUpdateSchema,
  availabilityDeleteSchema,
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
    expect(result.location_status).toBe('in_office')
    expect(result.languages).toEqual([])
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

  it('accepts new profile fields', () => {
    const result = technicianCreateSchema.parse({
      staff_member_id: VALID_UUID,
      display_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '+48123456789',
      location_status: 'on_trip',
      languages: ['en', 'pl'],
      vehicle_id: VALID_UUID,
      vehicle_label: 'Van #1',
      current_order_id: VALID_UUID,
    })
    expect(result.display_name).toBe('John Doe')
    expect(result.location_status).toBe('on_trip')
    expect(result.languages).toEqual(['en', 'pl'])
    expect(result.vehicle_id).toBe(VALID_UUID)
  })

  it('accepts certifications with enhanced fields', () => {
    const result = technicianCreateSchema.parse({
      staff_member_id: VALID_UUID,
      certifications: [{
        name: 'ISO 9001',
        cert_type: 'quality',
        code: 'ISO-001',
        issued_by: 'TUV',
        issued_at: '2026-01-01',
        expires_at: '2028-01-01',
        notes: 'Annual renewal',
      }],
    })
    expect(result.certifications![0].cert_type).toBe('quality')
    expect(result.certifications![0].code).toBe('ISO-001')
    expect(result.certifications![0].issued_by).toBe('TUV')
    expect(result.certifications![0].notes).toBe('Annual renewal')
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

  it('accepts partial updates with new fields', () => {
    const result = technicianUpdateSchema.parse({
      id: VALID_UUID,
      display_name: 'Updated Name',
      location_status: 'at_client',
      languages: ['de'],
    })
    expect(result.display_name).toBe('Updated Name')
    expect(result.location_status).toBe('at_client')
    expect(result.languages).toEqual(['de'])
    expect(result.is_active).toBeUndefined()
  })

  it('accepts nullable new fields set to null', () => {
    const result = technicianUpdateSchema.parse({
      id: VALID_UUID,
      email: null,
      vehicle_id: null,
    })
    expect(result.email).toBeNull()
    expect(result.vehicle_id).toBeNull()
  })
})

describe('locationStatusSchema', () => {
  it.each(['in_office', 'on_trip', 'at_client', 'unavailable'] as const)(
    'accepts valid status: %s',
    (status) => {
      expect(locationStatusSchema.parse(status)).toBe(status)
    },
  )

  it('rejects invalid status', () => {
    expect(() => locationStatusSchema.parse('sick')).toThrow()
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

  it('accepts enhanced fields', () => {
    const result = certificationAddSchema.parse({
      technician_id: VALID_UUID,
      name: 'Welding',
      cert_type: 'trade',
      code: 'WC-001',
      issued_by: 'Authority',
      notes: 'Level 3',
    })
    expect(result.cert_type).toBe('trade')
    expect(result.code).toBe('WC-001')
    expect(result.issued_by).toBe('Authority')
    expect(result.notes).toBe('Level 3')
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

  it('accepts partial enhanced field updates', () => {
    const result = certificationUpdateSchema.parse({
      id: VALID_UUID,
      notes: 'Renewed annually',
      cert_type: 'quality',
      issued_by: 'TUV',
    })
    expect(result.notes).toBe('Renewed annually')
    expect(result.cert_type).toBe('quality')
    expect(result.issued_by).toBe('TUV')
    expect(result.name).toBeUndefined()
    expect(result.code).toBeUndefined()
  })
})

describe('certificationRemoveSchema', () => {
  it('accepts valid UUID', () => {
    const result = certificationRemoveSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })
})

describe('availabilityDayTypeSchema', () => {
  it.each(['work_day', 'trip', 'unavailable', 'holiday'] as const)(
    'accepts valid day type: %s',
    (type) => {
      expect(availabilityDayTypeSchema.parse(type)).toBe(type)
    },
  )

  it('rejects invalid day type', () => {
    expect(() => availabilityDayTypeSchema.parse('sick')).toThrow()
  })
})

describe('availabilityCreateSchema', () => {
  it('accepts valid input', () => {
    const result = availabilityCreateSchema.parse({
      technician_id: VALID_UUID,
      date: '2026-04-15',
      day_type: 'holiday',
    })
    expect(result.technician_id).toBe(VALID_UUID)
    expect(result.date).toBe('2026-04-15')
    expect(result.day_type).toBe('holiday')
  })

  it('defaults day_type to work_day', () => {
    const result = availabilityCreateSchema.parse({
      technician_id: VALID_UUID,
      date: '2026-04-15',
    })
    expect(result.day_type).toBe('work_day')
  })

  it('rejects invalid date format', () => {
    expect(() => availabilityCreateSchema.parse({
      technician_id: VALID_UUID,
      date: 'not-a-date',
    })).toThrow()
  })

  it('rejects missing technician_id', () => {
    expect(() => availabilityCreateSchema.parse({ date: '2026-04-15' })).toThrow()
  })

  it('rejects missing date', () => {
    expect(() => availabilityCreateSchema.parse({ technician_id: VALID_UUID })).toThrow()
  })
})

describe('availabilityUpdateSchema', () => {
  it('requires id', () => {
    expect(() => availabilityUpdateSchema.parse({})).toThrow()
  })

  it('accepts partial update', () => {
    const result = availabilityUpdateSchema.parse({
      id: VALID_UUID,
      day_type: 'trip',
    })
    expect(result.day_type).toBe('trip')
    expect(result.notes).toBeUndefined()
  })

  it('accepts notes update', () => {
    const result = availabilityUpdateSchema.parse({
      id: VALID_UUID,
      notes: 'Out of office',
    })
    expect(result.notes).toBe('Out of office')
  })
})

describe('availabilityDeleteSchema', () => {
  it('requires id', () => {
    expect(() => availabilityDeleteSchema.parse({})).toThrow()
  })

  it('accepts valid id', () => {
    const result = availabilityDeleteSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('rejects invalid id', () => {
    expect(() => availabilityDeleteSchema.parse({ id: 'bad' })).toThrow()
  })
})
