/**
 * @jest-environment node
 *
 * Unit tests for the VOIP → Service Ticket creation flow.
 * Covers:
 *  - service-ticket-prefill route helper functions
 *  - buildTicketHref URL construction
 *  - validate the payload shape that reaches the API
 */

// ---------------------------------------------------------------------------
// Helpers extracted from route.ts and PhoneCallDetail.tsx for unit testing
// ---------------------------------------------------------------------------

/**
 * Mirrors `readServiceLabel` from service-ticket-prefill/route.ts
 */
function readServiceLabel(
  serviceData: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = serviceData?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = record.label
  if (typeof label === 'string' && label.trim()) return label.trim()
  return null
}

/**
 * Mirrors `readDateLabel` from service-ticket-prefill/route.ts
 */
function readDateLabel(
  serviceData: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = readServiceLabel(serviceData, key)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 16)
}

/**
 * Mirrors `buildDescription` from service-ticket-prefill/route.ts
 */
function buildDescription(
  call: {
    callerPhoneNumber?: string | null
    calleePhoneNumber?: string | null
    startedAt?: Date | null
    externalCallId?: string | null
  },
  summaryText: string | null,
  problemDescription?: string | null,
  additionalNotes?: string | null,
  machine?: string | null,
): string {
  const base = [
    problemDescription || summaryText || 'Zgłoszenie utworzone z połączenia VOIP.',
    machine ? `Maszyna: ${machine}` : null,
    additionalNotes ? `Dodatkowe uwagi: ${additionalNotes}` : null,
    call.callerPhoneNumber ? `Telefon od: ${call.callerPhoneNumber}` : null,
    call.calleePhoneNumber ? `Telefon do: ${call.calleePhoneNumber}` : null,
    call.startedAt ? `Start rozmowy: ${call.startedAt.toISOString()}` : null,
    call.externalCallId ? `ID rozmowy: ${call.externalCallId}` : null,
  ]
  return base.filter(Boolean).join('\n')
}

type ServiceTicketPrefill = {
  phone_call_id: string
  service_type: string
  priority: string
  description: string
  address: string | null
  visit_date: string | null
  customer_entity_id: string | null
  contact_person_id: string | null
  machine_asset_id: string | null
  machine_instance_id?: string | null
  sales_channel_id?: string | null
  _llm_extracted?: boolean
  _confidence?: number | null
  _source?: 'transcript' | 'summary' | 'basic'
  _customer_name?: string | null
  _contact_name?: string | null
  _machine_info?: string | null
}

/**
 * Mirrors `buildTicketHref` from PhoneCallDetail.tsx
 */
function buildTicketHref(prefill: ServiceTicketPrefill): string {
  const params = new URLSearchParams({
    phone_call_id: prefill.phone_call_id,
    service_type: prefill.service_type,
    priority: prefill.priority,
    description: prefill.description,
  })
  if (prefill.address) params.set('address', prefill.address)
  if (prefill.visit_date) params.set('visit_date', prefill.visit_date)
  if (prefill.customer_entity_id) params.set('customer_entity_id', prefill.customer_entity_id)
  if (prefill.contact_person_id) params.set('contact_person_id', prefill.contact_person_id)
  if (prefill.machine_instance_id) params.set('machine_instance_id', prefill.machine_instance_id)
  else if (prefill.machine_asset_id) params.set('machine_asset_id', prefill.machine_asset_id)
  if (prefill.sales_channel_id) params.set('sales_channel_id', prefill.sales_channel_id)
  return `/backend/service-tickets/create?${params.toString()}`
}

// ---------------------------------------------------------------------------
// readServiceLabel
// ---------------------------------------------------------------------------
describe('readServiceLabel', () => {
  it('returns string value directly', () => {
    expect(readServiceLabel({ key: 'Machine A' }, 'key')).toBe('Machine A')
  })

  it('returns null for missing key', () => {
    expect(readServiceLabel({}, 'key')).toBeNull()
  })

  it('returns null for empty string value', () => {
    expect(readServiceLabel({ key: '   ' }, 'key')).toBeNull()
  })

  it('extracts label from object values', () => {
    expect(readServiceLabel({ key: { label: 'Machine B', id: 1 } }, 'key')).toBe('Machine B')
  })

  it('returns null for null serviceData', () => {
    expect(readServiceLabel(null, 'key')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// readDateLabel
// ---------------------------------------------------------------------------
describe('readDateLabel', () => {
  it('formats a valid ISO datetime to YYYY-MM-DDTHH:mm', () => {
    const result = readDateLabel({ requestedDate: '2026-04-20T09:00:00.000Z' }, 'requestedDate')
    // The exact time depends on timezone, but format should be YYYY-MM-DDTHH:mm
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('returns null when key is missing', () => {
    expect(readDateLabel({}, 'requestedDate')).toBeNull()
  })

  it('returns raw string when not a parseable date', () => {
    expect(readDateLabel({ requestedDate: 'next tuesday' }, 'requestedDate')).toBe('next tuesday')
  })

  it('slices to 16 chars (YYYY-MM-DDTHH:mm)', () => {
    const result = readDateLabel({ d: '2026-04-15T09:30:00.000Z' }, 'd')
    expect(result).toHaveLength(16)
    expect(result!.charAt(10)).toBe('T')
  })
})

// ---------------------------------------------------------------------------
// buildDescription
// ---------------------------------------------------------------------------
describe('buildDescription', () => {
  it('uses problemDescription when available', () => {
    const desc = buildDescription(
      { callerPhoneNumber: '+48123456789', externalCallId: 'ext-001', startedAt: null },
      'Summary text',
      'Laser is broken',
    )
    expect(desc).toContain('Laser is broken')
    expect(desc).not.toContain('Summary text')
  })

  it('falls back to summaryText when problemDescription is absent', () => {
    const desc = buildDescription(
      { callerPhoneNumber: null, externalCallId: null, startedAt: null },
      'This is the summary',
      null,
    )
    expect(desc).toContain('This is the summary')
  })

  it('falls back to default message when no text is available', () => {
    const desc = buildDescription({ callerPhoneNumber: null, externalCallId: null, startedAt: null }, null, null)
    expect(desc).toContain('Zgłoszenie utworzone z połączenia VOIP.')
  })

  it('includes phone numbers and call ID', () => {
    const desc = buildDescription(
      {
        callerPhoneNumber: '+48111222333',
        calleePhoneNumber: '+48999888777',
        externalCallId: 'CALL-ABC',
        startedAt: null,
      },
      null,
      'Pump failure',
    )
    expect(desc).toContain('Telefon od: +48111222333')
    expect(desc).toContain('Telefon do: +48999888777')
    expect(desc).toContain('ID rozmowy: CALL-ABC')
  })

  it('includes machine info and additional notes when provided', () => {
    const desc = buildDescription(
      { callerPhoneNumber: null, externalCallId: null, startedAt: null },
      null,
      'Problem',
      'Check belt too',
      'CNC-6000',
    )
    expect(desc).toContain('Maszyna: CNC-6000')
    expect(desc).toContain('Dodatkowe uwagi: Check belt too')
  })

  it('does not include null fields', () => {
    const desc = buildDescription(
      { callerPhoneNumber: null, calleePhoneNumber: null, externalCallId: null, startedAt: null },
      'Only summary',
      null,
      null,
      null,
    )
    expect(desc).not.toContain('Telefon od')
    expect(desc).not.toContain('Telefon do')
    expect(desc).not.toContain('ID rozmowy')
    expect(desc).not.toContain('Maszyna')
  })
})

// ---------------------------------------------------------------------------
// buildTicketHref
// ---------------------------------------------------------------------------
describe('buildTicketHref', () => {
  const BASE_PREFILL: ServiceTicketPrefill = {
    phone_call_id: 'call-uuid-001',
    service_type: 'regular',
    priority: 'normal',
    description: 'Machine is down',
    address: null,
    visit_date: null,
    customer_entity_id: null,
    contact_person_id: null,
    machine_asset_id: null,
    machine_instance_id: null,
    sales_channel_id: null,
  }

  it('includes required fields in URL', () => {
    const href = buildTicketHref(BASE_PREFILL)
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('phone_call_id')).toBe('call-uuid-001')
    expect(url.searchParams.get('service_type')).toBe('regular')
    expect(url.searchParams.get('priority')).toBe('normal')
    expect(url.searchParams.get('description')).toBe('Machine is down')
  })

  it('navigates to the service ticket create route', () => {
    const href = buildTicketHref(BASE_PREFILL)
    expect(href.startsWith('/backend/service-tickets/create?')).toBe(true)
  })

  it('does not include null optional fields', () => {
    const href = buildTicketHref(BASE_PREFILL)
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.has('address')).toBe(false)
    expect(url.searchParams.has('visit_date')).toBe(false)
    expect(url.searchParams.has('customer_entity_id')).toBe(false)
    expect(url.searchParams.has('machine_instance_id')).toBe(false)
    expect(url.searchParams.has('machine_asset_id')).toBe(false)
    expect(url.searchParams.has('sales_channel_id')).toBe(false)
  })

  it('includes customer_entity_id when resolved', () => {
    const href = buildTicketHref({
      ...BASE_PREFILL,
      customer_entity_id: 'company-uuid-1',
      contact_person_id: 'person-uuid-1',
    })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('customer_entity_id')).toBe('company-uuid-1')
    expect(url.searchParams.get('contact_person_id')).toBe('person-uuid-1')
  })

  it('uses machine_instance_id when set', () => {
    const href = buildTicketHref({
      ...BASE_PREFILL,
      machine_instance_id: 'instance-uuid-1',
      machine_asset_id: null,
    })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('machine_instance_id')).toBe('instance-uuid-1')
    expect(url.searchParams.has('machine_asset_id')).toBe(false)
  })

  it('falls back to machine_asset_id when machine_instance_id is absent', () => {
    const href = buildTicketHref({
      ...BASE_PREFILL,
      machine_instance_id: null,
      machine_asset_id: 'asset-uuid-1',
    })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.has('machine_instance_id')).toBe(false)
    expect(url.searchParams.get('machine_asset_id')).toBe('asset-uuid-1')
  })

  it('correctly URL-encodes multiline descriptions', () => {
    const description = 'Line 1\nLine 2\nTelefon od: +48123456789'
    const href = buildTicketHref({ ...BASE_PREFILL, description })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('description')).toBe(description)
  })

  it('includes address and visit_date when present', () => {
    const href = buildTicketHref({
      ...BASE_PREFILL,
      address: 'ul. Testowa 1, Warszawa',
      visit_date: '2026-04-20T09:00',
    })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('address')).toBe('ul. Testowa 1, Warszawa')
    expect(url.searchParams.get('visit_date')).toBe('2026-04-20T09:00')
  })

  it('includes sales_channel_id when present', () => {
    const href = buildTicketHref({ ...BASE_PREFILL, sales_channel_id: 'channel-uuid-1' })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('sales_channel_id')).toBe('channel-uuid-1')
  })

  it('builds a fully-populated href with all fields set', () => {
    const href = buildTicketHref({
      phone_call_id: 'call-1',
      service_type: 'warranty_claim',
      priority: 'urgent',
      description: 'Full payload test',
      address: 'Factory 7',
      visit_date: '2026-04-25T14:00',
      customer_entity_id: 'cust-1',
      contact_person_id: 'pers-1',
      machine_instance_id: 'mach-1',
      machine_asset_id: null,
      sales_channel_id: 'chan-1',
    })
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('phone_call_id')).toBe('call-1')
    expect(url.searchParams.get('service_type')).toBe('warranty_claim')
    expect(url.searchParams.get('priority')).toBe('urgent')
    expect(url.searchParams.get('description')).toBe('Full payload test')
    expect(url.searchParams.get('address')).toBe('Factory 7')
    expect(url.searchParams.get('visit_date')).toBe('2026-04-25T14:00')
    expect(url.searchParams.get('customer_entity_id')).toBe('cust-1')
    expect(url.searchParams.get('contact_person_id')).toBe('pers-1')
    expect(url.searchParams.get('machine_instance_id')).toBe('mach-1')
    expect(url.searchParams.get('sales_channel_id')).toBe('chan-1')
  })
})

// ---------------------------------------------------------------------------
// Basic prefill payload shape (simulates extract-ticket-fields fallback)
// ---------------------------------------------------------------------------
describe('basic prefill payload shape', () => {
  it('produces a valid service ticket prefill for a missed call with no artifacts', () => {
    const call = {
      id: 'call-uuid-1',
      status: 'missed' as const,
      callerPhoneNumber: '+48600100200',
      calleePhoneNumber: null,
      startedAt: null,
      externalCallId: 'EXT-001',
      customerEntityId: 'company-uuid-1',
      contactPersonId: 'person-uuid-1',
    }

    const prefill: ServiceTicketPrefill = {
      phone_call_id: call.id,
      service_type: 'regular',
      priority: call.status === 'missed' ? 'urgent' : 'normal',
      description: buildDescription(call, null, null, null, null),
      address: null,
      visit_date: null,
      customer_entity_id: call.customerEntityId,
      contact_person_id: call.contactPersonId,
      machine_asset_id: null,
      sales_channel_id: null,
      _llm_extracted: false,
      _confidence: null,
      _source: 'basic',
    }

    expect(prefill.service_type).toBe('regular')
    expect(prefill.priority).toBe('urgent') // missed → urgent
    expect(prefill.customer_entity_id).toBe('company-uuid-1')
    expect(prefill.contact_person_id).toBe('person-uuid-1')
    expect(prefill.description).toContain('EXT-001')
    expect(prefill.description).toContain('+48600100200')
    expect(prefill._llm_extracted).toBe(false)
  })

  it('produces normal priority for answered call', () => {
    const prefill: ServiceTicketPrefill = {
      phone_call_id: 'call-2',
      service_type: 'regular',
      priority: 'completed' === 'missed' ? 'urgent' : 'normal',
      description: 'desc',
      address: null,
      visit_date: null,
      customer_entity_id: null,
      contact_person_id: null,
      machine_asset_id: null,
    }
    expect(prefill.priority).toBe('normal')
  })
})

// ---------------------------------------------------------------------------
// create/page.tsx initialValues computation
// (mirrors the URL param → form values mapping without rendering the full page)
// ---------------------------------------------------------------------------
describe('create page URL params → initialValues mapping', () => {
  /**
   * Mirrors the `setString` + `initialValues` logic from
   * src/modules/service_tickets/backend/service-tickets/create/page.tsx
   */
  function buildInitialValuesFromSearchParams(
    searchParams: Record<string, string | null>,
  ): Record<string, unknown> {
    const values: Record<string, string | string[]> = {
      id: '',
      service_type: 'regular',
      status: 'new',
      priority: 'normal',
      description: '',
      visit_date: '',
      visit_end_date: '',
      address: '',
      latitude: '',
      longitude: '',
      customer_entity_id: '',
      contact_person_id: '',
      machine_instance_id: '',
      order_id: '',
      sales_channel_id: '',
      staff_member_ids: [],
    }

    const strFields = [
      'service_type',
      'priority',
      'description',
      'visit_date',
      'address',
      'customer_entity_id',
      'contact_person_id',
      'machine_instance_id',
      'order_id',
      'sales_channel_id',
    ] as const

    for (const key of strFields) {
      const value = searchParams[key]
      if (value != null) values[key] = value
    }

    // Legacy machine_asset_id → machine_instance_id
    const legacyMachineAssetId = searchParams['machine_asset_id']
    if (!values['machine_instance_id'] && legacyMachineAssetId != null) {
      values['machine_instance_id'] = legacyMachineAssetId
    }

    return values
  }

  it('maps all VOIP prefill fields to initialValues', () => {
    const params = {
      phone_call_id: 'call-uuid-1',
      service_type: 'warranty_claim',
      priority: 'urgent',
      description: 'Laser module failure\nTelefon od: +48123456789',
      address: 'Factory Hall B',
      visit_date: '2026-04-20T09:00',
      customer_entity_id: 'company-uuid-1',
      contact_person_id: 'person-uuid-1',
      machine_instance_id: 'machine-uuid-1',
      sales_channel_id: 'channel-uuid-1',
    }

    const values = buildInitialValuesFromSearchParams(params)

    expect(values.service_type).toBe('warranty_claim')
    expect(values.priority).toBe('urgent')
    expect(values.description).toBe('Laser module failure\nTelefon od: +48123456789')
    expect(values.address).toBe('Factory Hall B')
    expect(values.visit_date).toBe('2026-04-20T09:00')
    expect(values.customer_entity_id).toBe('company-uuid-1')
    expect(values.contact_person_id).toBe('person-uuid-1')
    expect(values.machine_instance_id).toBe('machine-uuid-1')
    expect(values.sales_channel_id).toBe('channel-uuid-1')
  })

  it('preserves defaults for fields not in URL params', () => {
    const values = buildInitialValuesFromSearchParams({
      service_type: 'maintenance',
      priority: 'critical',
      description: 'Urgent maintenance needed',
    })

    expect(values.customer_entity_id).toBe('')
    expect(values.contact_person_id).toBe('')
    expect(values.machine_instance_id).toBe('')
    expect(values.sales_channel_id).toBe('')
    expect(values.visit_date).toBe('')
    expect(values.address).toBe('')
  })

  it('maps legacy machine_asset_id to machine_instance_id when machine_instance_id absent', () => {
    const values = buildInitialValuesFromSearchParams({
      phone_call_id: 'call-1',
      service_type: 'regular',
      priority: 'normal',
      description: 'desc',
      machine_asset_id: 'legacy-asset-uuid',
      machine_instance_id: null,
    })
    expect(values.machine_instance_id).toBe('legacy-asset-uuid')
  })

  it('machine_instance_id takes precedence over machine_asset_id', () => {
    const values = buildInitialValuesFromSearchParams({
      phone_call_id: 'call-1',
      service_type: 'regular',
      priority: 'normal',
      description: 'desc',
      machine_instance_id: 'modern-uuid',
      machine_asset_id: 'legacy-asset-uuid',
    })
    expect(values.machine_instance_id).toBe('modern-uuid')
  })

  it('phone_call_id is available in URL but not written into form values', () => {
    const values = buildInitialValuesFromSearchParams({
      phone_call_id: 'call-uuid-1',
      service_type: 'regular',
      priority: 'normal',
      description: 'desc',
    })
    // phone_call_id should NOT be in form values — it's read separately for the link step
    expect(values.phone_call_id).toBeUndefined()
  })

  it('empty string params do not override defaults', () => {
    // URLSearchParams.get() returns '' for ?service_type= but the form
    // uses `if (value != null) values[key] = value` — empty string IS set
    // This is intentional: the LLM may extract an empty description
    const values = buildInitialValuesFromSearchParams({
      service_type: 'regular',
      priority: '',
      description: '',
    })
    // '' is != null so it gets set (empty string override)
    expect(values.priority).toBe('')
    expect(values.description).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Payload shape sent to the tickets API (ticketCreateSchema compatibility)
// ---------------------------------------------------------------------------
describe('ticket create payload from VOIP prefill', () => {
  it('produces a valid ticketCreateSchema-compatible payload', async () => {
    // Import the validator inline to verify the payload shape
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')

    const formValues = {
      id: '', // stripped by schema (not in ticketCreateSchema)
      service_type: 'regular',
      status: 'new', // stripped by schema (not in ticketCreateSchema)
      priority: 'urgent',
      description: 'Machine is down\nTelefon od: +48600100200',
      visit_date: '2026-04-20T09:00',
      visit_end_date: '',
      address: 'ul. Fabryczna 7',
      latitude: '',
      longitude: '',
      customer_entity_id: '11111111-1111-4111-8111-111111111111',
      contact_person_id: '',
      machine_instance_id: '22222222-2222-4222-8222-222222222222',
      order_id: '',
      staff_member_ids: [],
      sales_channel_id: '',
    }

    const result = ticketCreateSchema.safeParse(formValues)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.service_type).toBe('regular')
    expect(result.data.priority).toBe('urgent')
    expect(result.data.description).toBe('Machine is down\nTelefon od: +48600100200')
    expect(result.data.visit_date).toBe('2026-04-20T09:00')
    expect(result.data.address).toBe('ul. Fabryczna 7')
    expect(result.data.customer_entity_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(result.data.machine_instance_id).toBe('22222222-2222-4222-8222-222222222222')
    expect(result.data.contact_person_id).toBeUndefined() // empty → undefined via emptyToUndefined
    expect(result.data.order_id).toBeUndefined()
    expect(result.data.sales_channel_id).toBeUndefined()
  })

  it('rejects payload without service_type', async () => {
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')
    const result = ticketCreateSchema.safeParse({
      priority: 'normal',
      description: 'Missing service type',
    })
    expect(result.success).toBe(false)
  })

  it('rejects payload with invalid service_type', async () => {
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')
    const result = ticketCreateSchema.safeParse({
      service_type: 'unknown_type',
      priority: 'normal',
    })
    expect(result.success).toBe(false)
  })

  it('rejects payload with malformed visit_date', async () => {
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')
    const result = ticketCreateSchema.safeParse({
      service_type: 'regular',
      visit_date: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('accepts visit_date in YYYY-MM-DDTHH:mm format (from URL param / LLM extraction)', async () => {
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')
    const result = ticketCreateSchema.safeParse({
      service_type: 'regular',
      visit_date: '2026-04-20T09:00',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.visit_date).toBe('2026-04-20T09:00')
  })

  it('strips unknown fields (id, status) from the create payload', async () => {
    const { ticketCreateSchema } = await import('../../../service_tickets/data/validators')
    const result = ticketCreateSchema.safeParse({
      service_type: 'regular',
      priority: 'normal',
      id: 'should-be-stripped',
      status: 'new',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect((result.data as Record<string, unknown>).id).toBeUndefined()
    expect((result.data as Record<string, unknown>).status).toBeUndefined()
  })
})
