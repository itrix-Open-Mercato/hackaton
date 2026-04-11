# Service Tickets

## Purpose

Central work-order module for field-service operations. Coordinators register service requests, assign technicians, schedule visits, track linked customer machines, and maintain service history.

## Requirements

### Requirement: Ticket CRUD

The system SHALL support creating, viewing, updating, and soft-deleting service tickets.

Each ticket stores: ticket number (auto-generated `SRV-NNNNNN`), service type, status, priority, description, visit start/end dates, service address, customer reference, contact person, machine reference, optional order reference, and assigned technicians.

#### Scenario: Create ticket
- **WHEN** coordinator submits the create form
- **THEN** a ticket is created with auto-generated ticket number (format `SRV-NNNNNN`, retry logic for race conditions)
- **AND** status defaults to `new`, priority defaults to `normal`
- **AND** staff assignments are created if technicians provided
- **AND** `service_tickets.ticket.created` event is emitted

#### Scenario: Update ticket
- **WHEN** coordinator edits a ticket
- **THEN** fields are updated
- **AND** if visit date changed, a `ServiceTicketDateChange` record is created
- **AND** if status changed, `service_tickets.ticket.status_changed` event is emitted
- **AND** if customer company changed, contact person is cleared

#### Scenario: Delete ticket
- **WHEN** coordinator deletes a ticket
- **THEN** ticket is soft-deleted (deletedAt set)
- **AND** `service_tickets.ticket.deleted` event is emitted

---

### Requirement: Statuses, Types, and Priorities

**Decided statuses:** `new`, `scheduled`, `in_progress`, `completed`, `on_hold`, `cancelled`

**Decided service types:** `commissioning`, `regular`, `warranty_claim`, `maintenance`

**Decided priorities:** `normal`, `urgent`, `critical`

Each enum has color-coded badges in the UI and full EN/PL translations.

---

### Requirement: Customer Cascade Select

The system SHALL provide a two-step company → contact person selection instead of raw UUID entry.

#### Scenario: Select company
- **WHEN** coordinator types in the company field
- **THEN** an autocomplete searches `/api/customers/companies`
- **AND** results appear as selectable options

#### Scenario: Select contact person
- **WHEN** a company is selected
- **THEN** the contact person dropdown loads people from that company
- **AND** if company changes, the contact person selection is cleared

#### Scenario: No company selected
- **WHEN** no company is selected
- **THEN** the contact person field is disabled

**Decision:** Implemented using `ComboboxInput` components (not CrudForm's asyncSelect). Company search hits `/api/customers/companies?search=`. People loaded via `/api/customers/companies/{id}?include=people`.

---

### Requirement: Table Filtering

The ticket list SHALL support filtering by status, service type, and priority via multi-select dropdowns, plus free-text search across ticket number and description.

#### Scenario: Multi-select filter
- **WHEN** user selects values in a filter dropdown
- **THEN** query params are sent as comma-separated values (e.g. `status=new,scheduled`)
- **AND** the table refreshes showing only matching tickets

#### Scenario: Search
- **WHEN** user types in the search box
- **THEN** case-insensitive ILIKE search runs against ticket_number and description

#### Scenario: Date range
- **WHEN** user sets visit date range filters
- **THEN** results are filtered by `visit_date_from` / `visit_date_to`

---

### Requirement: Parts List

The system SHALL support a parts list per ticket (product reference, quantity, optional notes) via a separate CRUD API.

**Decision:** Parts are managed via `/api/service_tickets/parts` endpoints, not embedded in the ticket form. Parts use hard delete (not soft delete).

---

### Requirement: Date Change History

The system SHALL record visit-date changes for auditability.

#### Scenario: Visit date modified
- **WHEN** ticket update changes the visit date
- **THEN** a `ServiceTicketDateChange` record is created with old date, new date, and the user who made the change

---

### Requirement: Technician Assignment

The system SHALL support assigning one or more technicians (staff members) to a ticket.

**Decision:** Assignments managed via `staff_member_ids` array in the ticket create/update payload. Stored in `service_ticket_assignments` junction table with unique constraint on (ticket, staffMember).

---

### Requirement: Backend UI Pages

Three pages implemented:

| Page | Path | Auth |
|---|---|---|
| List | `/backend/service-tickets` | `service_tickets.view` |
| Create | `/backend/service-tickets/create` | `service_tickets.create` |
| Edit | `/backend/service-tickets/[id]/edit` | `service_tickets.edit` |

**Decision:** Edit page is a flat form (not a tabbed detail view). The original plan called for tabs (Overview, Technicians, Parts, History) but implementation went with a simpler single-page edit form. Parts and history are API-only for now.

---

### Requirement: Access Control

| Role | Permissions |
|---|---|
| superadmin | `service_tickets.*` |
| admin | `service_tickets.*` |
| employee | `view`, `create`, `edit` (no delete) |

---

### Requirement: Events

Four events emitted, all with `clientBroadcast: true`:

- `service_tickets.ticket.created`
- `service_tickets.ticket.updated`
- `service_tickets.ticket.deleted`
- `service_tickets.ticket.status_changed`

---

### Requirement: Internationalization

Full EN and PL translations for all page titles, nav group, form labels, enum values, table columns, button labels, flash messages, and validation errors.

---

## Decisions Log

| Decision | Rationale |
|---|---|
| Edit page instead of tabbed detail view | Simpler to build within hackathon timeframe; parts/history remain API-accessible |
| ComboboxInput for cascade select | CrudForm doesn't natively support asyncSelect; custom component approach more flexible |
| Parts via separate API, not in ticket form | Keeps ticket form focused; parts can be managed independently |
| Hard delete for parts | Parts are operational data, not audit-critical; simplifies implementation |
| Contact person cleared on company change | Prevents stale person references when company changes |
| Ticket number retry logic (3 attempts) | Handles race conditions on concurrent ticket creation |
| No seed data in setup.ts | Deferred; original plan mentioned demo data but not implemented |
| Soft delete for tickets only | Tickets are audit-critical; assignments, parts, date changes are not |
