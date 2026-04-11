# Service Protocols Module

**Date**: 2026-04-11
**Status**: Draft
**Source**: `C:\Users\Robert\Downloads\protokol_prac_v1.0 (1).docx`

## TLDR

The `service_protocols` module records the actual service work performed after a `service_tickets` ticket has moved beyond intake. A protocol is created from a service ticket, copies the planned customer, machine, technician, address, visit, description, and proposed parts data, then lets the service team replace the plan with actual execution data.

The MVP creates a database-backed protocol workflow: draft completion by technicians, coordinator-controlled billing flags, review, approval, closing, and change history. It prepares cost data for future modules but does not create invoices, PDFs, online signatures, or customer emails in v1.0.

## Overview

Service tickets describe what should be done. Service protocols describe what was actually done.

The protocol starts from a `service_tickets.ServiceTicket` so technicians do not fill the same customer, machine, address, planned visit, assigned staff, and proposed part data again. After conversion, the protocol becomes an independent operational record with snapshots of key source data. Technicians edit execution details, while coordinators control billing decisions and final approval.

The module is intentionally separate from `service_tickets` and uses the module id `service_protocols`. This keeps the ticket intake workflow and the post-work confirmation workflow independently evolvable while still linked through `serviceTicketId` and events.

Market reference: field-service tools such as Odoo Field Service treat work reports as structured operational records before they become PDFs or invoices. This spec adopts that split: structured protocol data first, document/invoice generation later.

## Problem Statement

Without a service protocol, the system can register and plan a service ticket but cannot reliably answer:

- What was actually repaired or inspected?
- Which technician worked how many hours?
- Which parts were actually used instead of merely proposed?
- Which work, travel, and parts are billable?
- Who reviewed and approved the work?
- What changed after the ticket was created?

If this data remains in free text, attachments, or manual spreadsheets, it cannot safely feed future cost, invoicing, customer history, or machine history features.

## Proposed Solution

Create a new app-local module `service_protocols` under `src/modules/service_protocols`.

The module provides:

- Protocol creation from an existing `service_ticket`
- Snapshotting of source ticket data
- Editable technician work lines
- Editable part usage lines
- Coordinator-only billing controls
- Review and approval workflow
- Closed protocol locking
- Structured change history
- Prepared cost summary data for future cost/invoice modules

The protocol must have at least one technician. Manual parts without a catalog product are allowed in MVP because field work often discovers parts that were not planned or not yet present in the catalog.

Closing a protocol does not automatically complete the linked service ticket. Instead, the coordinator explicitly confirms the ticket completion during close. This prevents accidental ticket closure when a protocol is approved but follow-up work is still required.

## Design Decisions

| Decision | Rationale |
|---|---|
| Create separate module `service_protocols` | Protocols are a post-execution workflow, not just ticket fields. Separate ownership keeps ticket intake simpler. |
| Require at least one technician | A protocol confirms performed service work; an empty crew would be invalid operational data. |
| Billing flags editable only by coordinator | Technicians can report work, but billing decisions are commercial/control decisions. |
| Prepare cost data only in MVP | Cost modules and invoicing are future scope; MVP should not fake downstream accounting behavior. |
| Allow manual parts | Technicians must be able to record real consumed items even if the catalog is incomplete. |
| Coordinator confirms ticket completion | Closing the protocol and completing the ticket are related but not identical business decisions. |

## Scope

### In Scope for MVP

- Backend list and detail/edit pages for protocols
- Action on a service ticket: create protocol
- Protocol status workflow: `draft`, `in_review`, `approved`, `closed`, `cancelled`
- Technician lines with work time, travel, delegation, and billing flags
- Part lines with proposed, used, added, removed, and billing state
- Coordinator review actions: reject, approve, close, cancel, unlock
- History entries for status changes and meaningful edits
- Prepared cost summary fields or computed response payloads
- Optional coordinator confirmation to complete linked service ticket during close
- Unit tests for validators and commands
- API route tests for conversion and status actions
- Integration coverage for ticket-to-protocol creation and close confirmation

### Out of Scope for MVP

- PDF generation
- Customer or technician online signatures
- Email sending to customer
- Invoice creation
- Real cost ledger persistence in a dedicated cost module
- Customer portal protocol acceptance
- Offline mobile technician workflow

## User Stories

- As a coordinator, I want to create a protocol from a service ticket so that the technician starts from planned work data instead of an empty form.
- As a technician, I want to record actual hours, kilometers, delegation, notes, and parts so that the company has a reliable work record.
- As a coordinator, I want to control billing flags per technician and part so that commercial decisions remain reviewed before close.
- As a coordinator, I want to reject a protocol with a comment so that the technician knows what must be fixed.
- As a manager, I want closed protocols to expose prepared cost data so that future reporting and invoicing can consume structured data.

## Architecture

### Module Placement

```text
src/modules/service_protocols/
  index.ts
  acl.ts
  setup.ts
  events.ts
  data/entities.ts
  data/validators.ts
  commands/protocols.ts
  commands/technicians.ts
  commands/parts.ts
  api/protocols/route.ts
  api/technicians/route.ts
  api/parts/route.ts
  api/history/route.ts
  api/openapi.ts
  backend/service-protocols/page.tsx
  backend/service-protocols/[id]/page.tsx
  backend/service-protocols/[id]/edit/page.tsx
  components/
  i18n/en.json
  i18n/pl.json
  migrations/
```

Register with:

```typescript
{ id: 'service_protocols', from: '@app' }
```

### Module Boundaries

- Link to `service_tickets` by `serviceTicketId` only.
- Link to customers by `customerEntityId` and `contactPersonId` only.
- Link to resources by `machineAssetId` only.
- Link to staff by `staffMemberId` only.
- Link to catalog by `catalogProductId` only.
- Do not create ORM relationships across module boundaries.

Within `service_protocols`, `ServiceProtocolTechnician`, `ServiceProtocolPart`, and `ServiceProtocolHistory` may use ORM relations to `ServiceProtocol`.

### Source Conversion

Creating a protocol reads the source `ServiceTicket`, its `ServiceTicketAssignment` rows, and its `ServiceTicketPart` rows. The command creates:

- one `ServiceProtocol`
- one `ServiceProtocolTechnician` per assigned staff member
- one `ServiceProtocolPart` per proposed ticket part
- one `ServiceProtocolHistory` entry with `eventType = 'created_from_ticket'`

The source ticket remains unchanged during protocol creation.

## Data Models

### ServiceProtocol

Table: `service_protocols`

- `id`: UUID primary key
- `tenant_id`: UUID
- `organization_id`: UUID
- `service_ticket_id`: UUID, required
- `protocol_number`: text, unique per tenant and organization, e.g. `PROT-2026-0041`
- `status`: `draft | in_review | approved | closed | cancelled`
- `type`: `standard | valuation_only`
- `customer_entity_id`: UUID, nullable
- `contact_person_id`: UUID, nullable
- `machine_asset_id`: UUID, nullable
- `service_address_snapshot`: JSONB, nullable
- `ticket_description_snapshot`: text, nullable
- `planned_visit_date_snapshot`: timestamp, nullable
- `planned_visit_end_date_snapshot`: timestamp, nullable
- `work_description`: text, nullable
- `technician_notes`: text, nullable
- `customer_notes`: text, nullable
- `prepared_cost_summary`: JSONB, nullable
- `is_active`: boolean, default true
- `closed_at`: timestamp, nullable
- `closed_by_user_id`: UUID, nullable
- `completed_ticket_on_close`: boolean, default false
- `created_by_user_id`: UUID, nullable
- `created_at`: timestamp
- `updated_at`: timestamp
- `deleted_at`: timestamp, nullable

Indexes:

- `(tenant_id, organization_id)`
- `(service_ticket_id, tenant_id, organization_id)`
- `(status, tenant_id, organization_id)`
- unique `(protocol_number, tenant_id, organization_id)`
- unique active protocol per source ticket where `status != cancelled` and `deleted_at IS NULL`

### ServiceProtocolTechnician

Table: `service_protocol_technicians`

- `id`: UUID primary key
- `tenant_id`: UUID
- `organization_id`: UUID
- `protocol_id`: UUID relation to `ServiceProtocol`
- `staff_member_id`: UUID
- `date_from`: date, nullable
- `date_to`: date, nullable
- `hours_worked`: decimal, default 0
- `hourly_rate_snapshot`: decimal, nullable
- `is_billable`: boolean, default false
- `km_driven`: decimal, default 0
- `km_rate_snapshot`: decimal, nullable
- `km_is_billable`: boolean, default false
- `delegation_days`: integer, default 0
- `delegation_country`: text, nullable
- `diet_rate_snapshot`: decimal, nullable
- `hotel_invoice_ref`: text, nullable
- `hotel_amount`: decimal, nullable
- `created_at`: timestamp
- `updated_at`: timestamp
- `deleted_at`: timestamp, nullable

Rules:

- Unique active `(protocol_id, staff_member_id)`
- `hours_worked >= 0`
- `km_driven >= 0`
- `delegation_days >= 0`
- `delegation_country` must be ISO 3166-1 alpha-2 when present
- `is_billable` and `km_is_billable` may only be modified by `service_protocols.manage`

### ServiceProtocolPart

Table: `service_protocol_parts`

- `id`: UUID primary key
- `tenant_id`: UUID
- `organization_id`: UUID
- `protocol_id`: UUID relation to `ServiceProtocol`
- `catalog_product_id`: UUID, nullable
- `name_snapshot`: text, required
- `part_code_snapshot`: text, nullable
- `quantity_proposed`: decimal, default 0
- `quantity_used`: decimal, default 0
- `unit`: text, nullable
- `unit_price_snapshot`: decimal, nullable
- `is_billable`: boolean, default false
- `line_status`: `proposed | confirmed | added | removed`
- `notes`: text, nullable
- `created_at`: timestamp
- `updated_at`: timestamp
- `deleted_at`: timestamp, nullable

Rules:

- Manual parts are allowed when `catalog_product_id` is null.
- Manual parts must have `name_snapshot`.
- `quantity_used >= 0`.
- `quantity_used = 0` should normally produce `line_status = removed`.
- `is_billable` may only be modified by `service_protocols.manage`.

### ServiceProtocolHistory

Table: `service_protocol_history`

- `id`: UUID primary key
- `tenant_id`: UUID
- `organization_id`: UUID
- `protocol_id`: UUID relation to `ServiceProtocol`
- `event_type`: `created_from_ticket | status_change | field_edit | technician_added | technician_removed | part_changed | rejected | approved | closed | unlocked | cancelled`
- `old_value`: JSONB, nullable
- `new_value`: JSONB, nullable
- `performed_by_user_id`: UUID, nullable
- `performed_at`: timestamp
- `notes`: text, nullable
- `created_at`: timestamp
- `updated_at`: timestamp

Rules:

- `notes` is required for reject and unlock.

## API Contracts

All routes require auth and must export `openApi`.

### Protocols CRUD and Conversion

`GET /api/service_protocols/protocols`

Query:

- `id`
- `ids`
- `serviceTicketId`
- `status`
- `customerEntityId`
- `machineAssetId`
- `staffMemberId`
- `search`
- `page`
- `pageSize <= 100`
- `sortField`
- `sortDir`

Response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "totalCount": 0
}
```

`POST /api/service_protocols/protocols`

Creates a protocol from a service ticket.

Request:

```json
{
  "service_ticket_id": "uuid"
}
```

Response `201`:

```json
{
  "id": "uuid",
  "protocolNumber": "PROT-2026-0041",
  "status": "draft",
  "serviceTicketId": "uuid"
}
```

Validation:

- Source ticket must exist in the same tenant and organization.
- Source ticket status must not be `new` or `cancelled`.
- Source ticket must have at least one assigned technician.
- Source ticket must not already have an active protocol.

`PUT /api/service_protocols/protocols`

Edits protocol header and work fields.

Technicians may edit:

- `work_description`
- `technician_notes`
- `customer_notes`

Coordinators may also edit:

- header snapshots when protocol is not `approved` or `closed`

`DELETE /api/service_protocols/protocols`

Soft deletes or cancels depending on command design. Prefer `cancel` action for user-facing cancellation.

### Technician Lines

`GET /api/service_protocols/technicians?protocolId=:id`

`POST /api/service_protocols/technicians`

Request:

```json
{
  "protocol_id": "uuid",
  "staff_member_id": "uuid"
}
```

`PUT /api/service_protocols/technicians`

Request:

```json
{
  "id": "uuid",
  "hours_worked": 6.5,
  "km_driven": 240,
  "delegation_days": 1,
  "delegation_country": "PL",
  "hotel_invoice_ref": "FV/1/2026",
  "hotel_amount": 320
}
```

Coordinator-only fields:

```json
{
  "is_billable": true,
  "km_is_billable": true,
  "hourly_rate_snapshot": 180,
  "km_rate_snapshot": 1.15,
  "diet_rate_snapshot": 45
}
```

`DELETE /api/service_protocols/technicians`

Removes a technician line when protocol is editable. Reject removal if it would leave the protocol without technicians.

### Part Lines

`GET /api/service_protocols/parts?protocolId=:id`

`POST /api/service_protocols/parts`

Allows catalog-backed or manual parts.

Request:

```json
{
  "protocol_id": "uuid",
  "catalog_product_id": "uuid-or-null",
  "name_snapshot": "Manual part name",
  "quantity_used": 1,
  "unit": "pcs",
  "line_status": "added"
}
```

`PUT /api/service_protocols/parts`

Request:

```json
{
  "id": "uuid",
  "quantity_used": 1,
  "line_status": "confirmed",
  "notes": "Used during pump replacement"
}
```

Coordinator-only fields:

```json
{
  "is_billable": true,
  "unit_price_snapshot": 250
}
```

`DELETE /api/service_protocols/parts`

Soft deletes a line or marks it as `removed`. For proposed lines, prefer `line_status = removed` to preserve the planned-vs-actual audit trail.

### Status Actions

`POST /api/service_protocols/protocols/submit`

Request:

```json
{ "id": "uuid" }
```

Moves `draft -> in_review`.

`POST /api/service_protocols/protocols/reject`

Request:

```json
{ "id": "uuid", "notes": "Missing work description" }
```

Moves `in_review -> draft`. Requires coordinator permission.

`POST /api/service_protocols/protocols/approve`

Request:

```json
{ "id": "uuid" }
```

Moves `in_review -> approved`. Requires coordinator permission.

`POST /api/service_protocols/protocols/close`

Request:

```json
{
  "id": "uuid",
  "complete_service_ticket": true
}
```

Moves `approved -> closed`, writes prepared cost summary, and only completes the linked service ticket when `complete_service_ticket` is true.

`POST /api/service_protocols/protocols/cancel`

Request:

```json
{ "id": "uuid", "notes": "Created by mistake" }
```

Moves protocol to `cancelled`.

`POST /api/service_protocols/protocols/unlock`

Request:

```json
{ "id": "uuid", "notes": "Correction after coordinator review" }
```

Moves `closed -> approved`. Requires coordinator permission and history note.

## Commands

- `service_protocols.protocols.create_from_ticket`
- `service_protocols.protocols.update`
- `service_protocols.protocols.submit`
- `service_protocols.protocols.reject`
- `service_protocols.protocols.approve`
- `service_protocols.protocols.close`
- `service_protocols.protocols.cancel`
- `service_protocols.protocols.unlock`
- `service_protocols.technicians.create`
- `service_protocols.technicians.update`
- `service_protocols.technicians.delete`
- `service_protocols.parts.create`
- `service_protocols.parts.update`
- `service_protocols.parts.delete`

All mutations must go through commands. Commands must write history entries for status changes and meaningful line changes.

## Events

Declare in `events.ts`:

- `service_protocols.protocol.created`
- `service_protocols.protocol.updated`
- `service_protocols.protocol.submitted`
- `service_protocols.protocol.rejected`
- `service_protocols.protocol.approved`
- `service_protocols.protocol.closed`
- `service_protocols.protocol.cancelled`
- `service_protocols.protocol.unlocked`
- `service_protocols.technician.updated`
- `service_protocols.part.updated`

When a protocol closes with `complete_service_ticket = true`, update the ticket through a command or subscriber-mediated boundary. Do not directly mutate another module without a clear command/event boundary.

## Access Control

Features:

- `service_protocols.view`
- `service_protocols.view_own`
- `service_protocols.create`
- `service_protocols.edit`
- `service_protocols.manage`
- `service_protocols.close`
- `service_protocols.view_costs`
- `service_protocols.delete`

Default role grants:

- `superadmin`: `service_protocols.*`
- `admin`: `service_protocols.*`
- `employee`: `service_protocols.view_own`, `service_protocols.create`, `service_protocols.edit`

Rules:

- Technician users with only `view_own` see protocols where their `staffMemberId` appears in active `ServiceProtocolTechnician` rows.
- Coordinator permission is represented by `service_protocols.manage`.
- Billing flags and rates require `service_protocols.manage`.
- Cost summary visibility requires `service_protocols.view_costs`.

## UI Requirements

### Service Ticket Integration

On service ticket detail/edit UI, add a "Create protocol" action when:

- ticket status is not `new`
- ticket status is not `cancelled`
- ticket has at least one assigned technician
- no active protocol exists

If a protocol already exists, show "Open protocol" instead.

### Protocol List

Path: `/backend/service-protocols`

Columns:

- protocol number
- linked ticket number
- status
- customer
- machine
- planned visit date
- technician summary
- updated at

Filters:

- status
- technician
- customer
- machine
- search
- date range

### Protocol Detail/Edit

Sections:

- Header: protocol number, status, linked ticket, customer, machine
- Work summary: work description, technician notes, customer notes
- Technicians: hours, billing, km, delegation
- Parts: proposed, confirmed, added, removed
- Prepared costs: visible only with `service_protocols.view_costs`
- History
- Workflow actions

Coordinator close flow must include an explicit checkbox or confirmation:

```text
Complete linked service ticket after closing this protocol
```

## Validation Rules

- Cannot create protocol from ticket status `new` or `cancelled`.
- Cannot create a protocol from a ticket without technicians.
- Cannot create more than one active protocol per ticket.
- Cannot close unless status is `approved`.
- Cannot close unless `workDescription` is non-empty.
- Cannot close unless at least one technician has `hoursWorked > 0`.
- Cannot close while any part line has `lineStatus = proposed`.
- Cannot remove the last technician.
- Cannot edit closed protocol except through unlock.
- Reject and unlock require notes.
- Billing fields require `service_protocols.manage`.
- `pageSize` must be at most 100.

## Prepared Cost Summary

MVP does not create downstream cost ledger entries. Instead, closing a protocol stores or returns a prepared summary shaped for later integration.

Summary categories:

- technician labor
- technician travel kilometers
- delegation days
- hotel costs
- parts

Each summary row should include:

- source type
- source line id
- label
- quantity
- unit
- unit amount when visible
- total amount when visible
- billable flag
- internal-cost-only flag when applicable

Rates and totals are hidden unless the user has `service_protocols.view_costs`.

## Integration Coverage

### API Tests

- Create protocol from valid service ticket.
- Reject creation from `new` ticket.
- Reject creation from `cancelled` ticket.
- Reject creation from ticket without technicians.
- Reject duplicate active protocol for same ticket.
- Technician can update hours and km but not billing flags.
- Coordinator can update billing flags.
- Close fails without approved status.
- Close fails with proposed part lines.
- Close with `complete_service_ticket = false` leaves ticket unchanged.
- Close with `complete_service_ticket = true` completes linked ticket through the approved boundary.

### UI Tests

- Ticket page shows create/open protocol action correctly.
- Protocol form loads copied ticket data.
- Technician can update actual work fields.
- Coordinator can edit billing fields.
- Submit, reject, approve, and close transitions update visible status.
- Close confirmation controls linked ticket completion.

## Risks & Impact Review

| Risk | Severity | Affected Area | Mitigation | Residual Risk |
|---|---|---|---|---|
| Protocol closes with incomplete actual work data | High | Operations, billing readiness | Enforce close validations for technician hours, work description, and part statuses | Medium |
| Coordinator billing controls are bypassed | High | Commercial control | Validate billing fields server-side by permission, not only in UI | Low |
| Ticket completion happens accidentally | Medium | Service workflow | Require explicit close confirmation for `complete_service_ticket` | Low |
| Manual parts create messy catalog data | Medium | Reporting | Require name, unit, quantity; keep catalog link optional but snapshot clear | Medium |
| Cross-module updates become tightly coupled | Medium | Architecture | Use command/event boundary for service ticket completion | Medium |
| Cost summary diverges from future cost module | Medium | Future integration | Keep prepared summary minimal and source-line based | Medium |

## Final Compliance Report

- TLDR defines value and boundaries: yes.
- MVP and future scope separated: yes.
- Cross-module links use FK IDs only: yes.
- Tenant and organization scoping required on all entities: yes.
- Mutations use commands: yes.
- Events declared before use: required by implementation.
- API contracts include auth and OpenAPI expectations: yes.
- UI uses backend module pages and shared primitives: required by implementation.
- i18n planned for user-facing strings: yes.
- Integration coverage listed: yes.
- Known out-of-scope items documented: yes.

## Changelog

| Date | Change |
|---|---|
| 2026-04-11 | Initial draft from business protocol document and product decisions. |
| 2026-04-11 | Add missing `is_active` to ServiceProtocol; add `created_at`/`updated_at` to ServiceProtocolHistory per entity conventions. |
