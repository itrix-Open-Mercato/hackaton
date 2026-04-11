import { createServiceTicketPayloadSchema } from '../inbox-validators'

describe('createServiceTicketPayloadSchema', () => {
  // 6.1 Valid payload with only required field (description) passes validation
  it('passes with only description', () => {
    const result = createServiceTicketPayloadSchema.safeParse({ description: 'CNC machine breakdown' })
    expect(result.success).toBe(true)
  })

  // 6.2 Empty description fails with min-length error
  it('fails when description is empty', () => {
    const result = createServiceTicketPayloadSchema.safeParse({ description: '' })
    expect(result.success).toBe(false)
  })

  // 6.3 Invalid service_type enum value fails validation
  it('fails with invalid service_type', () => {
    const result = createServiceTicketPayloadSchema.safeParse({
      description: 'test',
      service_type: 'unknown_type',
    })
    expect(result.success).toBe(false)
  })

  // 6.4 Invalid priority enum value fails validation
  it('fails with invalid priority', () => {
    const result = createServiceTicketPayloadSchema.safeParse({
      description: 'test',
      priority: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  // 6.5 priority defaults to normal when omitted
  it('defaults priority to normal when omitted', () => {
    const result = createServiceTicketPayloadSchema.parse({ description: 'test' })
    expect(result.priority).toBe('normal')
  })

  // 6.6 customer_email with invalid email format fails validation
  it('fails with invalid email format', () => {
    const result = createServiceTicketPayloadSchema.safeParse({
      description: 'test',
      customer_email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  // 6.7 Full payload with all optional fields passes validation
  it('passes with full payload', () => {
    const result = createServiceTicketPayloadSchema.safeParse({
      customer_email: 'user@acme.com',
      customer_name: 'John Doe',
      customer_entity_id: '550e8400-e29b-41d4-a716-446655440000',
      machine_hints: ['CNC 6000', 'SN-12345'],
      machine_instance_id: '550e8400-e29b-41d4-a716-446655440001',
      service_type: 'warranty_claim',
      priority: 'urgent',
      description: 'Machine is broken',
      address: '123 Main St',
      contact_person_id: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(true)
  })

  // 6.8 Metadata fields pass validation when present
  it('passes with metadata fields', () => {
    const result = createServiceTicketPayloadSchema.safeParse({
      description: 'test',
      _confidence: 0.85,
      _discrepancies: [{ type: 'unknown_contact', message: 'No match' }],
      _customer_name: 'Acme Corp',
      _machine_label: 'CNC 6000 #SN-123',
    })
    expect(result.success).toBe(true)
  })
})
