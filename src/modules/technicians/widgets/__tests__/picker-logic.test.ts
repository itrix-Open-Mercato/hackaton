/**
 * @jest-environment node
 */

describe('technician picker toggle logic', () => {
  function toggleTechnician(selectedIds: string[], staffMemberId: string): string[] {
    return selectedIds.includes(staffMemberId)
      ? selectedIds.filter((id) => id !== staffMemberId)
      : [...selectedIds, staffMemberId]
  }

  const UUID_1 = '11111111-1111-4111-8111-111111111111'
  const UUID_2 = '22222222-2222-4222-8222-222222222222'
  const UUID_3 = '33333333-3333-4333-8333-333333333333'

  it('adds a technician to empty selection', () => {
    const result = toggleTechnician([], UUID_1)
    expect(result).toEqual([UUID_1])
  })

  it('adds a second technician to existing selection', () => {
    const result = toggleTechnician([UUID_1], UUID_2)
    expect(result).toEqual([UUID_1, UUID_2])
  })

  it('removes a technician when already selected', () => {
    const result = toggleTechnician([UUID_1, UUID_2], UUID_1)
    expect(result).toEqual([UUID_2])
  })

  it('writes correct staff_member_ids to form data', () => {
    const formValues: Record<string, unknown> = {
      id: 'ticket-id',
      staff_member_ids: [UUID_1],
    }

    const next = toggleTechnician(formValues.staff_member_ids as string[], UUID_2)
    const updatedFormValues = { ...formValues, staff_member_ids: next }

    expect(updatedFormValues.staff_member_ids).toEqual([UUID_1, UUID_2])
  })

  it('supports multiple selections (multi-technician)', () => {
    let ids: string[] = []
    ids = toggleTechnician(ids, UUID_1)
    ids = toggleTechnician(ids, UUID_2)
    ids = toggleTechnician(ids, UUID_3)
    expect(ids).toEqual([UUID_1, UUID_2, UUID_3])

    ids = toggleTechnician(ids, UUID_2)
    expect(ids).toEqual([UUID_1, UUID_3])
  })
})
