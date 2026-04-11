## Why

Service teams receive machine-related requests via email (breakdowns, maintenance scheduling, warranty claims), but InboxOps has no concept of service tickets. These emails get classified as `complaint`/`inquiry`/`other` with no actionable path to ticket creation. Operators must manually read the email, extract customer/machine/issue details, and re-type them into the service ticket form — error-prone and slow.

## What Changes

- Register `create_service_ticket` as a new InboxOps action type via the auto-discovered `inbox-actions.ts` mechanism in the `service_tickets` module
- Implement customer resolution logic: exact email match and domain-based matching against `customer_entities` / `customer_companies`
- Implement machine resolution logic: serial number, instance code, and fuzzy catalog profile matching against the resolved customer's machines
- Add LLM prompt schema and rules so the extraction worker proposes `create_service_ticket` for service-relevant emails (with extracted service type, priority, description, machine hints)
- Add confidence scoring that combines LLM confidence with customer/machine matching signals
- Add "Open Ticket Form" button on inbox proposal actions of type `create_service_ticket` — writes prefill data to sessionStorage and navigates to `/backend/service-tickets/create`
- Modify the ticket create page to read prefill data from sessionStorage on mount, merge into form initial values, and show an info banner with email context
- Surface discrepancies in the proposal UI: unknown sender, ambiguous customer, machine not found
- Mark inbox action as executed after successful ticket save

## Capabilities

### New Capabilities
- `inbox-service-ticket-action`: InboxOps action registration (`inbox-actions.ts`), payload schema, LLM prompt schema/rules, and `normalizePayload` with customer/machine resolution and confidence scoring
- `ticket-inbox-prefill`: sessionStorage-based prefill handoff from inbox proposal to ticket create form, info banner, and post-save action execution marking

### Modified Capabilities
- `service-tickets`: Ticket create page gains sessionStorage prefill support and post-save inbox action status update

## Impact

- **Modules touched**: `service_tickets` (new `inbox-actions.ts`, modified create page), no changes to `inbox_ops` core
- **APIs**: No new endpoints — uses existing `POST /api/service_tickets/tickets` and existing inbox proposal/action endpoints
- **Dependencies**: Reads from `customer_entities`, `customer_companies`, `machine_instances`, `machine_catalog_profiles` via Knex queries (cross-module, no ORM imports)
- **LLM**: New prompt schema and rules injected into the extraction worker's action registry; machine catalog context added to extraction prompt
- **UI**: New button on inbox proposal action cards; modified ticket create form mount logic; discrepancy indicators on proposal view
