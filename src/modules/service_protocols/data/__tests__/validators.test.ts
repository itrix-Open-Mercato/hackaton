/**
 * @jest-environment node
 */
import {
  createProtocolFromTicketSchema,
  updateProtocolSchema,
  rejectSchema,
  unlockSchema,
  cancelSchema,
  closeSchema,
  createTechnicianSchema,
  updateTechnicianSchema,
  createPartSchema,
  updatePartSchema,
  protocolStatusSchema,
  partLineStatusSchema,
} from '../validators'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('service_protocols validators', () => {
  // ─── Protocol schemas ────────────────────────────────────────────────────

  describe('createProtocolFromTicketSchema', () => {
    it('accepts a valid UUID for service_ticket_id', () => {
      expect(
        createProtocolFromTicketSchema.parse({ service_ticket_id: UUID }).service_ticket_id,
      ).toBe(UUID)
    })

    it('rejects a missing service_ticket_id', () => {
      expect(() => createProtocolFromTicketSchema.parse({})).toThrow()
    })

    it('rejects a non-UUID string', () => {
      expect(() =>
        createProtocolFromTicketSchema.parse({ service_ticket_id: 'not-a-uuid' }),
      ).toThrow()
    })
  })

  describe('updateProtocolSchema', () => {
    it('accepts partial text field updates', () => {
      const result = updateProtocolSchema.parse({
        id: UUID,
        work_description: 'Replaced pump',
        technician_notes: 'No issues',
        customer_notes: 'Customer informed',
      })
      expect(result.work_description).toBe('Replaced pump')
      expect(result.technician_notes).toBe('No issues')
    })

    it('coerces empty string to null for nullable fields', () => {
      const result = updateProtocolSchema.parse({ id: UUID, work_description: '' })
      expect(result.work_description).toBeNull()
    })

    it('accepts service_address_snapshot as a JSONB object', () => {
      const result = updateProtocolSchema.parse({
        id: UUID,
        service_address_snapshot: { street: 'Main St' },
      })
      expect(result.service_address_snapshot).toEqual({ street: 'Main St' })
    })

    it('rejects invalid protocol type', () => {
      expect(() =>
        updateProtocolSchema.parse({ id: UUID, type: 'invalid_type' }),
      ).toThrow()
    })

    it('accepts valid protocol types', () => {
      expect(updateProtocolSchema.parse({ id: UUID, type: 'standard' }).type).toBe('standard')
      expect(updateProtocolSchema.parse({ id: UUID, type: 'valuation_only' }).type).toBe('valuation_only')
    })
  })

  describe('protocolStatusSchema', () => {
    it('accepts all valid statuses', () => {
      const statuses = ['draft', 'in_review', 'approved', 'closed', 'cancelled']
      for (const s of statuses) {
        expect(protocolStatusSchema.parse(s)).toBe(s)
      }
    })

    it('rejects unknown status', () => {
      expect(() => protocolStatusSchema.parse('pending')).toThrow()
    })
  })

  // ─── Status action schemas ────────────────────────────────────────────────

  describe('rejectSchema', () => {
    it('accepts id + non-empty notes', () => {
      const result = rejectSchema.parse({ id: UUID, notes: 'Missing hours' })
      expect(result.notes).toBe('Missing hours')
    })

    it('rejects empty notes', () => {
      expect(() => rejectSchema.parse({ id: UUID, notes: '' })).toThrow(
        'Notes are required for rejection',
      )
    })

    it('rejects missing notes', () => {
      expect(() => rejectSchema.parse({ id: UUID })).toThrow()
    })
  })

  describe('unlockSchema', () => {
    it('accepts id + non-empty notes', () => {
      const result = unlockSchema.parse({ id: UUID, notes: 'Correction needed' })
      expect(result.notes).toBe('Correction needed')
    })

    it('rejects empty notes', () => {
      expect(() => unlockSchema.parse({ id: UUID, notes: '' })).toThrow(
        'Notes are required for unlock',
      )
    })
  })

  describe('cancelSchema', () => {
    it('accepts cancel with notes', () => {
      const result = cancelSchema.parse({ id: UUID, notes: 'Created by mistake' })
      expect(result.notes).toBe('Created by mistake')
    })

    it('accepts cancel without notes', () => {
      const result = cancelSchema.parse({ id: UUID })
      expect(result.notes).toBeUndefined()
    })
  })

  describe('closeSchema', () => {
    it('defaults complete_service_ticket to false', () => {
      const result = closeSchema.parse({ id: UUID })
      expect(result.complete_service_ticket).toBe(false)
    })

    it('accepts complete_service_ticket: true', () => {
      const result = closeSchema.parse({ id: UUID, complete_service_ticket: true })
      expect(result.complete_service_ticket).toBe(true)
    })
  })

  // ─── Technician schemas ───────────────────────────────────────────────────

  describe('createTechnicianSchema', () => {
    it('accepts protocol_id and staff_member_id', () => {
      const result = createTechnicianSchema.parse({
        protocol_id: UUID,
        staff_member_id: UUID,
      })
      expect(result.protocol_id).toBe(UUID)
      expect(result.staff_member_id).toBe(UUID)
    })

    it('rejects missing staff_member_id', () => {
      expect(() => createTechnicianSchema.parse({ protocol_id: UUID })).toThrow()
    })
  })

  describe('updateTechnicianSchema', () => {
    it('accepts non-negative hours_worked and km_driven', () => {
      const result = updateTechnicianSchema.parse({
        id: UUID,
        hours_worked: 7.5,
        km_driven: 200,
        delegation_days: 2,
      })
      expect(result.hours_worked).toBe(7.5)
      expect(result.km_driven).toBe(200)
      expect(result.delegation_days).toBe(2)
    })

    it('rejects negative hours_worked', () => {
      expect(() =>
        updateTechnicianSchema.parse({ id: UUID, hours_worked: -1 }),
      ).toThrow()
    })

    it('rejects negative km_driven', () => {
      expect(() =>
        updateTechnicianSchema.parse({ id: UUID, km_driven: -5 }),
      ).toThrow()
    })

    it('rejects negative delegation_days', () => {
      expect(() =>
        updateTechnicianSchema.parse({ id: UUID, delegation_days: -1 }),
      ).toThrow()
    })

    it('accepts valid ISO 3166-1 alpha-2 country code', () => {
      const result = updateTechnicianSchema.parse({ id: UUID, delegation_country: 'PL' })
      expect(result.delegation_country).toBe('PL')
    })

    it('rejects country code longer than 2 characters', () => {
      expect(() =>
        updateTechnicianSchema.parse({ id: UUID, delegation_country: 'POL' }),
      ).toThrow('ISO 3166-1 alpha-2')
    })

    it('rejects lowercase country code', () => {
      expect(() =>
        updateTechnicianSchema.parse({ id: UUID, delegation_country: 'pl' }),
      ).toThrow('ISO 3166-1 alpha-2')
    })

    it('accepts null delegation_country', () => {
      const result = updateTechnicianSchema.parse({ id: UUID, delegation_country: null })
      expect(result.delegation_country).toBeNull()
    })

    it('accepts coordinator-only billing fields as optional', () => {
      const result = updateTechnicianSchema.parse({
        id: UUID,
        is_billable: true,
        km_is_billable: false,
        hourly_rate_snapshot: 180,
        km_rate_snapshot: 1.15,
        diet_rate_snapshot: 45,
      })
      expect(result.is_billable).toBe(true)
      expect(result.hourly_rate_snapshot).toBe(180)
    })
  })

  // ─── Part schemas ─────────────────────────────────────────────────────────

  describe('createPartSchema', () => {
    it('accepts a manual part without catalog_product_id', () => {
      const result = createPartSchema.parse({
        protocol_id: UUID,
        name_snapshot: 'Gasket seal',
        quantity_used: 2,
      })
      expect(result.name_snapshot).toBe('Gasket seal')
      expect(result.catalog_product_id).toBeUndefined()
    })

    it('accepts a catalog-backed part', () => {
      const result = createPartSchema.parse({
        protocol_id: UUID,
        catalog_product_id: UUID,
        name_snapshot: 'Pump O-ring',
        quantity_used: 1,
      })
      expect(result.catalog_product_id).toBe(UUID)
    })

    it('rejects empty name_snapshot', () => {
      expect(() =>
        createPartSchema.parse({ protocol_id: UUID, name_snapshot: '' }),
      ).toThrow('Part name is required')
    })

    it('rejects missing name_snapshot', () => {
      expect(() =>
        createPartSchema.parse({ protocol_id: UUID }),
      ).toThrow()
    })

    it('rejects negative quantity_used', () => {
      expect(() =>
        createPartSchema.parse({ protocol_id: UUID, name_snapshot: 'Part', quantity_used: -1 }),
      ).toThrow()
    })

    it('accepts all valid line_status values', () => {
      const statuses = ['proposed', 'confirmed', 'added', 'removed']
      for (const s of statuses) {
        const result = createPartSchema.parse({
          protocol_id: UUID,
          name_snapshot: 'Part',
          line_status: s,
        })
        expect(result.line_status).toBe(s)
      }
    })
  })

  describe('updatePartSchema', () => {
    it('accepts quantity_used and line_status update', () => {
      const result = updatePartSchema.parse({
        id: UUID,
        quantity_used: 3,
        line_status: 'confirmed',
      })
      expect(result.quantity_used).toBe(3)
      expect(result.line_status).toBe('confirmed')
    })

    it('rejects negative quantity_used', () => {
      expect(() =>
        updatePartSchema.parse({ id: UUID, quantity_used: -2 }),
      ).toThrow()
    })

    it('rejects invalid line_status', () => {
      expect(() =>
        updatePartSchema.parse({ id: UUID, line_status: 'pending' }),
      ).toThrow()
    })

    it('accepts coordinator-only billing fields', () => {
      const result = updatePartSchema.parse({
        id: UUID,
        is_billable: true,
        unit_price_snapshot: 250,
      })
      expect(result.is_billable).toBe(true)
      expect(result.unit_price_snapshot).toBe(250)
    })
  })

  describe('partLineStatusSchema', () => {
    it('accepts all valid part line statuses', () => {
      for (const s of ['proposed', 'confirmed', 'added', 'removed']) {
        expect(partLineStatusSchema.parse(s)).toBe(s)
      }
    })

    it('rejects unknown line status', () => {
      expect(() => partLineStatusSchema.parse('deleted')).toThrow()
    })
  })
})
