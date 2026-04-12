import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'phone_calls.call.received', label: 'Phone Call Received', entity: 'call', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.call.synced', label: 'Phone Call Synced', entity: 'call', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.call.updated', label: 'Phone Call Updated', entity: 'call', category: 'crud', clientBroadcast: true },
  { id: 'phone_calls.service_ticket.linked', label: 'Phone Call Linked To Service Ticket', entity: 'call', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.service_ticket.unlinked', label: 'Phone Call Unlinked From Service Ticket', entity: 'call', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.service_ticket.created', label: 'Service Ticket Created From Phone Call', entity: 'call', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.transcript.stored', label: 'Phone Call Transcript Stored', entity: 'transcript', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.summary.generated', label: 'Phone Call Summary Generated', entity: 'summary', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.summary.regenerated', label: 'Phone Call Summary Regenerated', entity: 'summary', category: 'lifecycle', clientBroadcast: true },
  { id: 'phone_calls.retention.pruned', label: 'Phone Call Retention Pruned', entity: 'retention', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'phone_calls',
  events,
})

export const emitPhoneCallEvent = eventsConfig.emit

export type PhoneCallEventId = typeof events[number]['id']

export default eventsConfig
