# Service Protocols Module — Implementation Plan

**Spec**: `.ai/specs/2026-04-11-service-protocols-module.md`
**Module path**: `src/modules/service_protocols/`

---

## Status Legend
- [ ] Not started
- [x] Done

---

## Critical Prerequisite

- [ ] Clarify `service_tickets` module status — the spec links protocols to `ServiceTicket`, `ServiceTicketAssignment`, and `ServiceTicketPart`. No `service_tickets` module exists in `src/modules/`. Either create a minimal one first or confirm it will be provided.
- [ ] Clarify protocol number sequence strategy — `PROT-YYYY-NNNN` format; use framework sequence mechanism or `MAX + 1` query.

---

## Phase 1 — Data Layer

### 1. Entities (`src/modules/service_protocols/data/entities.ts`)

- [ ] `ServiceProtocol` entity (table: `service_protocols`)
  - Fields: `id`, `tenant_id`, `organization_id`, `service_ticket_id`, `protocol_number`, `status` (enum: `draft | in_review | approved | closed | cancelled`), `type` (enum: `standard | valuation_only`), `customer_entity_id`, `contact_person_id`, `machine_asset_id`, `service_address_snapshot` (jsonb), `ticket_description_snapshot`, `planned_visit_date_snapshot`, `planned_visit_end_date_snapshot`, `work_description`, `technician_notes`, `customer_notes`, `prepared_cost_summary` (jsonb), `is_active`, `closed_at`, `closed_by_user_id`, `completed_ticket_on_close`, `created_by_user_id`, `created_at`, `updated_at`, `deleted_at`
  - Indexes: `(tenant_id, organization_id)`, `(service_ticket_id, tenant_id, organization_id)`, `(status, tenant_id, organization_id)`, unique `(protocol_number, tenant_id, organization_id)`

- [ ] `ServiceProtocolTechnician` entity (table: `service_protocol_technicians`)
  - Fields: `id`, `tenant_id`, `organization_id`, `protocol_id` (`@ManyToOne` to `ServiceProtocol`), `staff_member_id`, `date_from`, `date_to`, `hours_worked`, `hourly_rate_snapshot`, `is_billable`, `km_driven`, `km_rate_snapshot`, `km_is_billable`, `delegation_days`, `delegation_country`, `diet_rate_snapshot`, `hotel_invoice_ref`, `hotel_amount`, `created_at`, `updated_at`, `deleted_at`
  - Unique active `(protocol_id, staff_member_id)`

- [ ] `ServiceProtocolPart` entity (table: `service_protocol_parts`)
  - Fields: `id`, `tenant_id`, `organization_id`, `protocol_id` (`@ManyToOne` to `ServiceProtocol`), `catalog_product_id`, `name_snapshot`, `part_code_snapshot`, `quantity_proposed`, `quantity_used`, `unit`, `unit_price_snapshot`, `is_billable`, `line_status` (enum: `proposed | confirmed | added | removed`), `notes`, `created_at`, `updated_at`, `deleted_at`

- [ ] `ServiceProtocolHistory` entity (table: `service_protocol_history`)
  - Fields: `id`, `tenant_id`, `organization_id`, `protocol_id` (`@ManyToOne` to `ServiceProtocol`), `event_type` (enum: `created_from_ticket | status_change | field_edit | technician_added | technician_removed | part_changed | rejected | approved | closed | unlocked | cancelled`), `old_value` (jsonb), `new_value` (jsonb), `performed_by_user_id`, `performed_at`, `notes`, `created_at`, `updated_at`

- [ ] Run `yarn mercato db generate`
- [ ] Review generated migration
- [ ] Confirm with user, then run `yarn mercato db migrate`

### 2. Validators (`src/modules/service_protocols/data/validators.ts`)

- [ ] `createProtocolFromTicketSchema` — `{ service_ticket_id: uuid }`
- [ ] `updateProtocolSchema` — work fields + coordinator-only header fields (partial, with `id`)
- [ ] `createTechnicianSchema`, `updateTechnicianSchema` (split: technician-editable vs. coordinator-only billing fields)
- [ ] `createPartSchema`, `updatePartSchema` (split: technician-editable vs. coordinator-only billing fields)
- [ ] Status action schemas: `submitSchema`, `rejectSchema` (notes required), `approveSchema`, `closeSchema` (with `complete_service_ticket` boolean), `cancelSchema`, `unlockSchema` (notes required)
- [ ] All types derived via `z.infer`

---

## Phase 2 — Commands

### 3. Protocol Commands (`src/modules/service_protocols/commands/protocols.ts`)

Follow `technician_schedule` command pattern: `registerCommand`, `CommandHandler`, `withAtomicFlush`, `buildLog`/`undo`.

- [ ] `service_protocols.protocols.create_from_ticket`
  - Reads source `ServiceTicket` + `ServiceTicketAssignment` rows + `ServiceTicketPart` rows
  - Validates: ticket exists in same tenant/org, status not `new`/`cancelled`, has at least one assignment, no active protocol exists for ticket
  - Creates: `ServiceProtocol` + one `ServiceProtocolTechnician` per assignment + one `ServiceProtocolPart` per proposed part + `ServiceProtocolHistory` entry `created_from_ticket`
  - Generates `protocol_number` (`PROT-YYYY-NNNN`)
  - All writes in single `withAtomicFlush` transaction

- [ ] `service_protocols.protocols.update`
  - Technician users: may edit `work_description`, `technician_notes`, `customer_notes`
  - Coordinators (`service_protocols.manage`): may also edit header snapshots when status is not `approved` or `closed`
  - Blocks edits on closed protocol
  - Writes `field_edit` history entry

- [ ] `service_protocols.protocols.submit`
  - `draft → in_review`
  - Writes `status_change` history entry

- [ ] `service_protocols.protocols.reject`
  - `in_review → draft`
  - Requires `service_protocols.manage`
  - Requires `notes`
  - Writes `rejected` history entry

- [ ] `service_protocols.protocols.approve`
  - `in_review → approved`
  - Requires `service_protocols.manage`
  - Writes `approved` history entry

- [ ] `service_protocols.protocols.close`
  - `approved → closed`
  - Validates: `work_description` non-empty, at least one technician with `hours_worked > 0`, no part line with `line_status = proposed`
  - Writes `prepared_cost_summary` (jsonb) with rows for labor, travel km, delegation days, hotel, parts
  - Sets `closed_at`, `closed_by_user_id`, `completed_ticket_on_close`
  - When `complete_service_ticket = true`: updates linked service ticket through command/event boundary (no direct mutation)
  - Writes `closed` history entry

- [ ] `service_protocols.protocols.cancel`
  - → `cancelled`
  - Writes `cancelled` history entry

- [ ] `service_protocols.protocols.unlock`
  - `closed → approved`
  - Requires `service_protocols.manage`
  - Requires `notes`
  - Writes `unlocked` history entry

### 4. Technician Commands (`src/modules/service_protocols/commands/technicians.ts`)

- [ ] `service_protocols.technicians.create` — adds technician line; protocol must be editable (not `approved`, `closed`, `cancelled`)
- [ ] `service_protocols.technicians.update` — blocks `is_billable`, `km_is_billable`, `hourly_rate_snapshot`, `km_rate_snapshot`, `diet_rate_snapshot` without `service_protocols.manage`; writes `technician_added`/`technician_removed` history
- [ ] `service_protocols.technicians.delete` — rejects if last technician; writes history

### 5. Part Commands (`src/modules/service_protocols/commands/parts.ts`)

- [ ] `service_protocols.parts.create` — allows `catalog_product_id = null`; manual parts require `name_snapshot`
- [ ] `service_protocols.parts.update` — blocks `is_billable`, `unit_price_snapshot` without `service_protocols.manage`; `quantity_used = 0` should set `line_status = removed`; writes `part_changed` history
- [ ] `service_protocols.parts.delete` — for `proposed` lines: prefer `line_status = removed` over hard delete

---

## Phase 3 — API Routes

Every route exports `openApi`. Custom write routes must call `validateCrudMutationGuard` / `runCrudMutationGuardAfterSuccess`.

- [ ] `GET /api/service_protocols/protocols` — list with filters: `id`, `ids`, `serviceTicketId`, `status`, `customerEntityId`, `machineAssetId`, `staffMemberId`, `search`, `page`, `pageSize` (max 100), `sortField`, `sortDir`
- [ ] `POST /api/service_protocols/protocols` — delegates to `create_from_ticket` command; returns `201` with `id`, `protocolNumber`, `status`, `serviceTicketId`
- [ ] `PUT /api/service_protocols/protocols` — delegates to `update` command
- [ ] `DELETE /api/service_protocols/protocols` — soft delete / cancel

- [ ] `POST /api/service_protocols/protocols/submit`
- [ ] `POST /api/service_protocols/protocols/reject`
- [ ] `POST /api/service_protocols/protocols/approve`
- [ ] `POST /api/service_protocols/protocols/close`
- [ ] `POST /api/service_protocols/protocols/cancel`
- [ ] `POST /api/service_protocols/protocols/unlock`

- [ ] `GET /api/service_protocols/technicians?protocolId=:id`
- [ ] `POST /api/service_protocols/technicians`
- [ ] `PUT /api/service_protocols/technicians`
- [ ] `DELETE /api/service_protocols/technicians`

- [ ] `GET /api/service_protocols/parts?protocolId=:id`
- [ ] `POST /api/service_protocols/parts`
- [ ] `PUT /api/service_protocols/parts`
- [ ] `DELETE /api/service_protocols/parts`

- [ ] `GET /api/service_protocols/history?protocolId=:id`

---

## Phase 4 — Module Wiring

- [ ] `src/modules/service_protocols/acl.ts` — 8 features: `view`, `view_own`, `create`, `edit`, `manage`, `close`, `view_costs`, `delete`
- [ ] `src/modules/service_protocols/setup.ts` — `defaultRoleFeatures`: `superadmin`/`admin` → `service_protocols.*`; `employee` → `view_own`, `create`, `edit`
- [ ] `src/modules/service_protocols/events.ts` — 10 events via `createModuleEvents` with `as const`: `protocol.created`, `protocol.updated`, `protocol.submitted`, `protocol.rejected`, `protocol.approved`, `protocol.closed`, `protocol.cancelled`, `protocol.unlocked`, `technician.updated`, `part.updated`
- [ ] `src/modules/service_protocols/di.ts` — register `ProtocolNumberService` (sequence generator for `PROT-YYYY-NNNN`)
- [ ] `src/modules/service_protocols/index.ts` — module metadata, re-export `features`
- [ ] Add `{ id: 'service_protocols', from: '@app' }` to `src/modules.ts`
- [ ] Run `yarn generate`

---

## Phase 5 — Backend UI

- [ ] `backend/service-protocols/page.tsx` — protocol list
  - `DataTable` with pagination props wired (`page`, `pageSize`, `totalCount`, `onPageChange`)
  - Columns: protocol number, linked ticket number, status (`EnumBadge`), customer, machine, planned visit date, technician summary, updated at
  - `FilterBar` filters: status, technician, customer, machine, search, date range

- [ ] `backend/service-protocols/[id]/page.tsx` — protocol detail
  - `FormHeader mode="detail"` with status badge and `ActionsDropdown` for workflow actions
  - Sections: Header, Work Summary, Technicians, Parts, Prepared Costs (gated by `view_costs`), History
  - Workflow action buttons: Submit, Reject, Approve, Close, Cancel, Unlock (conditional on status + permissions)
  - Close action must include checkbox: "Complete linked service ticket after closing this protocol"

- [ ] `backend/service-protocols/[id]/edit/page.tsx` — protocol edit form
  - `CrudForm` for editable fields (technician-editable and coordinator-editable sections split by permission)

- [ ] `components/TechnicianLinesTable.tsx` — inline editable table for technician lines
- [ ] `components/PartLinesTable.tsx` — inline editable table for part lines (proposed/confirmed/added/removed grouped or badged)
- [ ] `components/CostSummarySection.tsx` — prepared cost summary (only rendered when `view_costs` feature present)
- [ ] `components/ProtocolHistoryList.tsx` — history entries list

---

## Phase 6 — i18n

- [ ] `i18n/en.json` — all user-facing strings (field labels, status labels, action labels, validation messages)
- [ ] `i18n/pl.json` — Polish translations

---

## Phase 7 — Service Ticket Widget Injection

- [ ] `widgets/injection/ServiceTicketProtocolAction/widget.tsx` — injects "Create protocol" / "Open protocol" button into service ticket detail page
  - Show "Create protocol" when: ticket status not `new`/`cancelled`, ticket has assignments, no active protocol exists
  - Show "Open protocol" when active protocol exists
- [ ] `widgets/injection-table.ts` — map widget to `crud-form:service_tickets.ticket` or equivalent slot

---

## Notes

- Cross-module refs are FK IDs only — no ORM `@ManyToOne` across module boundaries except within `service_protocols` (technician/part/history → protocol)
- Closing a protocol that completes a service ticket must use a command/event boundary — never directly mutate `service_tickets` entities
- `is_billable`, billing rates, and `view_costs` fields must be enforced server-side by permission, not only in UI
- `pageSize` max 100
- Every API route must export `openApi`
- Sidebar icon must use `lucide-react`
