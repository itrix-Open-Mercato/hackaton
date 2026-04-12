/**
 * @jest-environment jsdom
 */
import { readAndConsumeInboxDraft, mergeInboxPrefill, markInboxActionExecuted } from '../inbox-prefill'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCall: jest.fn(),
}), { virtual: true })

const mockApiCall = apiCall as jest.MockedFunction<typeof apiCall>

const STORAGE_KEY = 'inbox_ops.serviceTicketDraft'

// Inline defaults to avoid transitive UI imports in tests
const defaults = {
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
  staff_member_ids: [] as string[],
}

describe('mergeInboxPrefill', () => {

  // 16.1 Merges non-empty fields into default form values
  it('merges non-empty fields into defaults', () => {
    const result = mergeInboxPrefill(defaults, {
      service_type: 'warranty_claim',
      priority: 'urgent',
      description: 'Machine is broken',
    })
    expect(result.service_type).toBe('warranty_claim')
    expect(result.priority).toBe('urgent')
    expect(result.description).toBe('Machine is broken')
  })

  // 16.2 Does not override existing defaults with empty/undefined prefill values
  it('does not override with empty or undefined values', () => {
    const result = mergeInboxPrefill(defaults, {
      service_type: '',
      priority: undefined as any,
      description: 'test',
    })
    expect(result.service_type).toBe('regular') // default preserved
    expect(result.priority).toBe('normal') // default preserved
    expect(result.description).toBe('test')
  })

  // 16.3 Handles all prefillable fields
  it('handles all prefillable fields', () => {
    const result = mergeInboxPrefill(defaults, {
      service_type: 'maintenance',
      priority: 'critical',
      description: 'Annual checkup',
      customer_entity_id: 'cust-1',
      contact_person_id: 'person-1',
      machine_instance_id: 'mach-1',
      sales_channel_id: 'channel-1',
      address: '123 Main St',
    })
    expect(result.service_type).toBe('maintenance')
    expect(result.priority).toBe('critical')
    expect(result.description).toBe('Annual checkup')
    expect(result.customer_entity_id).toBe('cust-1')
    expect(result.contact_person_id).toBe('person-1')
    expect(result.machine_instance_id).toBe('mach-1')
    expect(result.sales_channel_id).toBe('channel-1')
    expect(result.address).toBe('123 Main St')
  })

  it('maps legacy channelId to sales_channel_id', () => {
    const result = mergeInboxPrefill(defaults, { channelId: 'channel-2' })
    expect(result.sales_channel_id).toBe('channel-2')
  })
})

describe('readAndConsumeInboxDraft', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  // 16.4 Reads data and removes the key
  it('reads data from sessionStorage and removes the key', () => {
    const data = { actionId: 'a1', proposalId: 'p1', payload: { description: 'test' } }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    const result = readAndConsumeInboxDraft()
    expect(result).toEqual(data)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // 16.5 Missing key returns null
  it('returns null when key is missing', () => {
    expect(readAndConsumeInboxDraft()).toBeNull()
  })

  // 16.6 Malformed JSON handled gracefully
  it('returns null for malformed JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-json{{{')
    expect(readAndConsumeInboxDraft()).toBeNull()
  })

  it('returns null for valid JSON without payload', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'a1' }))
    expect(readAndConsumeInboxDraft()).toBeNull()
  })
})

describe('markInboxActionExecuted', () => {
  afterEach(() => {
    mockApiCall.mockReset()
  })

  // 18.1 Successful PATCH
  it('calls PATCH with correct params on success', async () => {
    mockApiCall.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof apiCall>>)
    const result = await markInboxActionExecuted('prop-1', 'act-1', 'ticket-123')
    expect(result).toBe(true)
    expect(mockApiCall).toHaveBeenCalledWith(
      '/api/inbox_ops/proposals/prop-1/actions/act-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          status: 'executed',
          createdEntityId: 'ticket-123',
          createdEntityType: 'service_ticket',
        }),
      }),
    )
  })

  // 18.2 No call without fromInboxAction (tested at page level, not here)

  // 18.3 PATCH failure returns false
  it('returns false on network error', async () => {
    mockApiCall.mockRejectedValue(new Error('Network error'))
    const result = await markInboxActionExecuted('prop-1', 'act-1', 'ticket-123')
    expect(result).toBe(false)
  })

  it('returns false on non-ok response', async () => {
    mockApiCall.mockResolvedValue({ ok: false, status: 500 } as Awaited<ReturnType<typeof apiCall>>)
    const result = await markInboxActionExecuted('prop-1', 'act-1', 'ticket-123')
    expect(result).toBe(false)
  })

  // 18.4 PATCH includes correct IDs
  it('includes correct proposal and action IDs in URL', async () => {
    mockApiCall.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof apiCall>>)
    await markInboxActionExecuted('my-proposal', 'my-action', 'new-ticket')
    expect(mockApiCall).toHaveBeenCalledWith(
      '/api/inbox_ops/proposals/my-proposal/actions/my-action',
      expect.anything(),
    )
  })
})
