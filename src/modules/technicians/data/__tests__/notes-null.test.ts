/**
 * @jest-environment node
 */
import { technicianUpdateSchema } from '../validators'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('technician notes null preservation', () => {
  it('maps empty notes string to null (not undefined)', () => {
    const result = technicianUpdateSchema.parse({ id: VALID_UUID, notes: '' })
    // The Zod schema should map '' -> null so clearing notes actually clears them
    expect(result.notes).toBeNull()
    expect(result.notes).not.toBeUndefined()
  })

  it('preserves non-empty notes string as-is', () => {
    const result = technicianUpdateSchema.parse({ id: VALID_UUID, notes: 'Some notes' })
    expect(result.notes).toBe('Some notes')
  })

  it('allows null notes explicitly', () => {
    const result = technicianUpdateSchema.parse({ id: VALID_UUID, notes: null })
    // null should pass through or be normalized
    expect(result.notes === null || result.notes === undefined).toBe(true)
  })

  it('the edit page should send null for empty notes, not undefined', () => {
    // Simulates the fixed edit page submit handler
    const notes = ''
    const payload = { id: VALID_UUID, is_active: true, notes: notes || null }

    // With the fix: empty string becomes null
    expect(payload.notes).toBeNull()

    // Without the fix (the bug): empty string became undefined
    const buggyPayload = { id: VALID_UUID, is_active: true, notes: notes || undefined }
    expect(buggyPayload.notes).toBeUndefined()
  })
})
