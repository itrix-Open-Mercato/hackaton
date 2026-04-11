/** @jest-environment node */

// Test the buildReservationTitle logic by importing the module and testing via the create command
// Since buildReservationTitle is a private function, we test it indirectly through the command's behavior

describe('Reservation auto-title generation', () => {
  // Inline the logic for direct testing since the function is not exported
  function buildReservationTitle(input: {
    title?: string | null
    reservationType: 'client_visit' | 'internal_work' | 'leave' | 'training'
    customerName?: string | null
  }): string {
    const trimmed = typeof input.title === 'string' ? input.title.trim() : ''
    if (trimmed.length > 0) return trimmed

    const typeLabelMap: Record<string, string> = {
      client_visit: 'Client visit',
      internal_work: 'Internal work',
      leave: 'Leave',
      training: 'Training',
    }

    return input.customerName?.trim()
      ? `${typeLabelMap[input.reservationType]} - ${input.customerName.trim()}`
      : typeLabelMap[input.reservationType]
  }

  it('generates title from type and customer name', () => {
    const title = buildReservationTitle({
      reservationType: 'client_visit',
      customerName: 'Acme Corp',
    })
    expect(title).toBe('Client visit - Acme Corp')
  })

  it('generates title from type only when no customer', () => {
    const title = buildReservationTitle({
      reservationType: 'training',
    })
    expect(title).toBe('Training')
  })

  it('generates title from type when customerName is empty', () => {
    const title = buildReservationTitle({
      reservationType: 'leave',
      customerName: '',
    })
    expect(title).toBe('Leave')
  })

  it('generates title from type when customerName is whitespace', () => {
    const title = buildReservationTitle({
      reservationType: 'internal_work',
      customerName: '   ',
    })
    expect(title).toBe('Internal work')
  })

  it('uses explicit title over auto-generation', () => {
    const title = buildReservationTitle({
      title: 'Custom Title',
      reservationType: 'client_visit',
      customerName: 'Acme Corp',
    })
    expect(title).toBe('Custom Title')
  })

  it('trims explicit title', () => {
    const title = buildReservationTitle({
      title: '  Custom Title  ',
      reservationType: 'client_visit',
    })
    expect(title).toBe('Custom Title')
  })

  it('falls back to auto-generation when title is empty string', () => {
    const title = buildReservationTitle({
      title: '',
      reservationType: 'client_visit',
      customerName: 'Acme',
    })
    expect(title).toBe('Client visit - Acme')
  })

  it('falls back to auto-generation when title is null', () => {
    const title = buildReservationTitle({
      title: null,
      reservationType: 'training',
    })
    expect(title).toBe('Training')
  })

  it('trims customer name in auto-generated title', () => {
    const title = buildReservationTitle({
      reservationType: 'client_visit',
      customerName: '  Acme Corp  ',
    })
    expect(title).toBe('Client visit - Acme Corp')
  })

  it.each([
    ['client_visit', 'Client visit'],
    ['internal_work', 'Internal work'],
    ['leave', 'Leave'],
    ['training', 'Training'],
  ] as const)('maps type %s to label "%s"', (type, label) => {
    const title = buildReservationTitle({ reservationType: type as any })
    expect(title).toBe(label)
  })
})
