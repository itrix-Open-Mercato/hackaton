import type { TicketFormValues } from '../components/ticketFormConfig'

export interface InboxDraftData {
  actionId: string
  proposalId: string
  payload: {
    service_type?: string
    priority?: string
    description?: string
    customer_entity_id?: string
    contact_person_id?: string
    machine_instance_id?: string
    address?: string
    _confidence?: number
    _discrepancies?: Array<{ type: string; message: string }>
    _customer_name?: string
    _machine_label?: string
    [key: string]: unknown
  }
}

const STORAGE_KEY = 'inbox_ops.serviceTicketDraft'

const PREFILLABLE_FIELDS = [
  'service_type',
  'priority',
  'description',
  'customer_entity_id',
  'contact_person_id',
  'machine_instance_id',
  'address',
] as const

export function readAndConsumeInboxDraft(): InboxDraftData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    const data = JSON.parse(raw) as InboxDraftData
    if (!data || typeof data !== 'object' || !data.payload) return null
    return data
  } catch {
    return null
  }
}

export function mergeInboxPrefill(
  defaults: TicketFormValues,
  payload: InboxDraftData['payload'],
): TicketFormValues {
  const merged = { ...defaults }
  for (const field of PREFILLABLE_FIELDS) {
    const value = payload[field]
    if (value != null && value !== '' && value !== undefined) {
      ;(merged as any)[field] = String(value)
    }
  }
  return merged
}

export async function markInboxActionExecuted(
  proposalId: string,
  actionId: string,
  createdEntityId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/inbox_ops/proposals/${proposalId}/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'executed',
        createdEntityId,
        createdEntityType: 'service_ticket',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
