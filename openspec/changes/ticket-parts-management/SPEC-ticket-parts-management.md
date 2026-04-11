# Ticket Parts Management & Machine-Driven Service Types

> Change: `ticket-parts-management` | Schema: `spec-driven` | Date: 2026-04-11

---

# 1. Proposal

## Why

When a machine is selected on a service ticket, the system shows recommended parts from the machine catalog profile, but the technician cannot act on those recommendations — there is no way to add a recommended part to the ticket with a single click. Parts must be managed through a separate API with no UI. This friction means parts tracking is effectively unused during the hackathon demo.

Additionally, service type is currently a free-choice enum on the ticket, but in practice different machines support different service types (e.g. a CNC machine may need commissioning + maintenance but not warranty_claim). The machine catalog profile already stores `supportedServiceTypes` and part templates already have `service_context`, but nothing connects them — the ticket form ignores both fields. Service type should be driven by the selected machine, and the recommended parts should filter by the chosen service type.

## What Changes

- Add a parts management section to the ticket edit page, showing parts currently attached to the ticket with inline add/edit/remove
- Add a one-click "add to ticket" action on each recommended part displayed in the machine info panel
- When adding a recommended part, pre-fill product reference, quantity, and notes from the catalog part template
- Show the parts list on the ticket detail/edit form so coordinators and technicians see what's needed at a glance
- Filter the service type dropdown on the ticket form to only show types supported by the selected machine (fall back to full enum when no machine is selected)
- Filter recommended parts by the selected service type (using the part template's `service_context` field)
- Display the machine's `supportedServiceTypes` in the machine hints panel

## Capabilities

### New Capabilities
- `ticket-parts-ui`: Inline parts management UI on the ticket edit page — add, edit quantity/notes, remove parts, with one-click add from machine catalog recommendations
- `machine-service-type-filter`: Service type selection driven by machine profile's `supportedServiceTypes`, and part recommendations filtered by selected service type's matching `service_context`

### Modified Capabilities
- `service-tickets`: The ticket edit page gains a parts section and the service type field becomes machine-aware

## Impact

- **UI**: `src/modules/service_tickets/components/` — new parts list component, modifications to `MachineCascadeSelect.tsx` (add-to-ticket buttons, service type list), ticket edit page layout, service type dropdown filtering
- **API**: No API changes needed — existing `/api/service_tickets/parts` CRUD endpoints and `/api/machine_catalog/part-templates` (already supports `serviceContext` filter) are sufficient
- **Data**: No schema/migration changes — `machine_catalog_profiles.supported_service_types` and `machine_catalog_part_templates.service_context` columns already exist. `service_tickets.service_type` column stays (stores the chosen type per ticket).
- **Dependencies**: Reads from `machine_catalog` part templates and machine profiles APIs (already wired in `machineOptions.ts`)

---

# 2. Design

## Context

The ticket edit page currently uses a `CrudForm` with three field groups: basic info, schedule, and links (machine + customer cascades). Parts exist only as an API (`/api/service_tickets/parts`) with no UI — coordinators cannot see or manage parts on a ticket without raw API calls.

The machine hints panel in `MachineCascadeSelect` already fetches and displays recommended part templates from the machine catalog, but they're read-only text. The part templates API returns `part_catalog_product_id` which maps directly to the `product_id` field that the ticket parts create command expects.

Service type is currently a flat enum dropdown on the ticket form (`commissioning | regular | warranty_claim | maintenance`), independent of the selected machine. However, `MachineCatalogProfile` already has a `supportedServiceTypes` jsonb array and part templates already have a `service_context` field. These fields exist in the schema but are not wired into the ticket UX.

## Goals / Non-Goals

**Goals:**
- Show ticket parts inline on the edit page with quantity and notes
- Let users add a recommended part to the ticket with one click from the machine hints panel
- Let users manually add, edit quantity/notes, and remove parts
- Filter the service type dropdown to only show types supported by the selected machine
- Filter recommended parts by the selected service type (matching `service_context`)
- Keep it simple — hackathon-grade UI, not a full inventory system

**Non-Goals:**
- Product catalog search/picker for manual part entry (use product_id from recommendations only for now)
- Parts on the create page (ticket must exist first since parts API requires `ticket_id`)
- Stock tracking, pricing, or invoicing
- Drag-and-drop reordering of parts
- Managing `supportedServiceTypes` on the machine profile (assumed to be seeded or set via machine catalog admin)

## Decisions

### Decision 1: Parts section below the CrudForm on the edit page

Add a `TicketPartsSection` component rendered below the `CrudForm` on the edit page. This avoids fighting CrudForm's field/group system which doesn't support sub-resource CRUD tables.

**Alternative considered:** Embedding parts inside a CrudForm custom field group. Rejected because CrudForm submit would try to serialize parts state, and parts have their own independent API lifecycle (separate create/update/delete calls).

### Decision 2: MachineCascadeSelect gets an `onAddPart` callback

Add an `onAddPart(template: MachinePartTemplateRecord)` prop to `MachineCascadeSelect`. Each recommended part in the hints panel gets a "+" button. When clicked, it calls `onAddPart` with the template data. The parent (`TicketPartsSection` or the edit page) handles the actual API call and list refresh.

**Alternative considered:** Having `MachineCascadeSelect` call the parts API directly. Rejected because it would couple the machine component to the parts API and make it harder to show optimistic updates in the parts list.

### Decision 3: Parts list as a simple table with inline actions

Render parts as a lightweight `<table>` with columns: part name, quantity, notes, and action buttons (edit/delete). No pagination needed (parts per ticket are typically < 20).

For editing: inline quantity/notes editing with a save button, not a modal dialog. Keeps interactions fast.

### Decision 4: Product name resolution via enrichment

The parts API returns `product_id` (UUID) but no product name. Two options:
- (a) Fetch catalog product names client-side by ID after loading parts
- (b) Store `product_name` snapshot on `ServiceTicketPart` entity

**Decision:** Option (a) — fetch product names client-side by calling `/api/machine_catalog/part-templates?ids=...` to resolve names. This avoids a migration and keeps the parts table normalized. The part templates already contain `part_name` and `part_code`. For parts added from recommendations, we can cache the template data locally since we already have it from the machine hints fetch.

**Fallback:** If a part's `product_id` doesn't match any template (manual API entry), show the UUID truncated. This is acceptable for hackathon scope.

### Decision 5: Wiring — edit page orchestrates state

The edit page becomes the coordinator:
1. Loads ticket data (existing flow)
2. Renders `CrudForm` for ticket fields (existing flow)
3. Renders `TicketPartsSection` below, passing `ticketId`
4. `TicketPartsSection` fetches parts list on mount
5. `MachineCascadeSelect` gets `onAddPart` — bubbled up from `TicketPartsSection` through form config
6. When a recommended part is added, `TicketPartsSection` calls POST `/api/service_tickets/parts` and refreshes

### Decision 6: MachinePartTemplateRecord needs partCatalogProductId

The `machineOptions.ts` parser currently omits `partCatalogProductId` from `MachinePartTemplateRecord`. We need to include it so the "add to ticket" action knows which `product_id` to send. Templates without a `partCatalogProductId` (manually entered names only) won't get an "add" button.

### Decision 7: Service type driven by machine profile

When a machine is selected on the ticket form:
1. The machine hints fetch already loads the `MachineCatalogProfile`
2. Expose `supportedServiceTypes` from the profile record (already in the API response as `supported_service_types`, but not parsed by `machineOptions.ts`)
3. Pass the supported types back up to the form so the service type `<select>` filters its options
4. If the currently selected service type is not in the machine's supported list, clear it (force re-selection)
5. When no machine is selected, show the full enum (backward-compatible)

**Alternative considered:** Making service type a property of the machine instance rather than the profile. Rejected because service types are a characteristic of the machine model (catalog), not the individual installed unit.

### Decision 8: Part recommendations filtered by service type

The part templates API already supports a `serviceContext` query parameter. When the user selects both a machine and a service type:
1. Re-fetch part templates with `serviceContext` filter matching the ticket's service type
2. The mapping between ticket `service_type` values and part template `service_context` values needs a lookup table (they use different terms: `commissioning` → `startup`, `maintenance` → `preventive`, `warranty_claim` → `reclamation`, `regular` → `repair`)

**Alternative considered:** Filtering client-side from the full list. Rejected because the API already supports server-side filtering, and it's cleaner. Also, a machine could have many part templates across all contexts — server filtering avoids over-fetching.

### Decision 9: Service type ↔ service context mapping

| Ticket `service_type` | Template `service_context` |
|---|---|
| `commissioning` | `startup` |
| `regular` | `repair` |
| `warranty_claim` | `reclamation` |
| `maintenance` | `preventive` |

This mapping lives in a shared constant so both the form filter and the part template fetch use the same logic.

## Risks / Trade-offs

- **Product name resolution is best-effort** — if part templates are deleted from the catalog after being added to a ticket, the name won't resolve. Acceptable for hackathon; a production system would snapshot the name. → Mitigation: show `product_id` as fallback.
- **No parts on create page** — users must save the ticket first, then add parts on edit. → Mitigation: this matches the existing API design (parts require `ticket_id`). Could add a post-create redirect to edit page.
- **CrudForm + separate section coupling** — the parts section is outside CrudForm's lifecycle, so "unsaved changes" warnings won't cover parts (parts save independently via their own API calls). → Mitigation: parts save immediately on each action, no "pending" state.
- **Service type ↔ service context naming mismatch** — the two enums use different terms. If either enum is extended, the mapping must be updated manually. → Mitigation: centralized mapping constant with a compile-time exhaustiveness check.
- **Clearing service type on machine change** — if the user already selected a service type and then picks a different machine that doesn't support it, the type is cleared. This could be surprising. → Mitigation: only clear if the current type is genuinely not in the new machine's supported list.
- **Machine profiles without supportedServiceTypes** — older profiles may have `null` for this field. → Mitigation: treat null/empty as "all types allowed" (no filtering).

---

# 3. Specifications

## 3a. Capability: ticket-parts-ui (NEW)

### Requirement: Parts list on ticket edit page

The system SHALL display a parts management section below the ticket form on the edit page, showing all parts currently attached to the ticket.

Each row SHALL display: part name (resolved from catalog template), quantity, notes, and action buttons (edit, delete).

The section SHALL load parts by calling `GET /api/service_tickets/parts?ticket_id={id}` on mount.

#### Scenario: Ticket has parts
- **WHEN** the edit page loads for a ticket that has parts
- **THEN** a "Parts" section appears below the ticket form
- **AND** each part is shown as a row with name, quantity, notes, and action buttons

#### Scenario: Ticket has no parts
- **WHEN** the edit page loads for a ticket with no parts
- **THEN** the "Parts" section appears with an empty state message

#### Scenario: Parts list refreshes after mutation
- **WHEN** a part is added, updated, or deleted
- **THEN** the parts list re-fetches from the API and re-renders

---

### Requirement: One-click add from recommended parts

The system SHALL display an "add to ticket" button next to each recommended part in the machine hints panel, but only for templates that have a `partCatalogProductId`.

Clicking the button SHALL create a `ServiceTicketPart` with `product_id` set to the template's `partCatalogProductId`, `quantity` pre-filled from `quantityDefault` (defaulting to 1), and the parts list SHALL refresh.

#### Scenario: Add recommended part to ticket
- **WHEN** user clicks the "+" button on a recommended part that has a `partCatalogProductId`
- **THEN** the system calls `POST /api/service_tickets/parts` with `ticket_id`, `product_id` (from template's `partCatalogProductId`), and `quantity` (from template's `quantityDefault`, or 1 if null)
- **AND** the parts list section refreshes to show the newly added part

#### Scenario: Recommended part without catalog product ID
- **WHEN** a recommended part template has no `partCatalogProductId`
- **THEN** no "add to ticket" button is shown for that template

#### Scenario: Duplicate add attempt
- **WHEN** user clicks "+" on a recommended part that is already in the ticket parts list (same `product_id`)
- **THEN** the system SHALL still create the part (duplicates are allowed — same product may be needed in different quantities or with different notes)

---

### Requirement: Inline part editing

The system SHALL allow editing quantity and notes on an existing ticket part inline, without navigating away from the page.

#### Scenario: Edit part quantity
- **WHEN** user clicks the edit button on a part row
- **THEN** quantity and notes fields become editable inline
- **AND** a save button appears

#### Scenario: Save part edits
- **WHEN** user modifies quantity or notes and clicks save
- **THEN** the system calls `PUT /api/service_tickets/parts` with `id`, updated `quantity`, and updated `notes`
- **AND** the row returns to display mode with updated values

#### Scenario: Cancel part edit
- **WHEN** user presses Escape while editing a part
- **THEN** the row reverts to display mode without saving

---

### Requirement: Delete part from ticket

The system SHALL allow removing a part from the ticket.

#### Scenario: Delete part
- **WHEN** user clicks the delete button on a part row
- **THEN** the system calls `DELETE /api/service_tickets/parts?id={partId}`
- **AND** the part disappears from the list

---

### Requirement: Part name resolution

The system SHALL resolve `product_id` UUIDs to human-readable part names using the machine catalog part templates data.

#### Scenario: Part added from recommendation
- **WHEN** a part was added from a recommended template
- **THEN** the part name, part code, and quantity unit are displayed from the cached template data

#### Scenario: Part with unresolvable product ID
- **WHEN** a part's `product_id` cannot be matched to any known template
- **THEN** the system SHALL display a truncated UUID as fallback (first 8 characters)

---

## 3b. Capability: machine-service-type-filter (NEW)

### Requirement: Service type filtered by machine profile

The ticket form's service type dropdown SHALL be filtered to show only the service types supported by the selected machine's catalog profile (`supportedServiceTypes` field).

When no machine is selected, or when the machine's profile has no `supportedServiceTypes` (null or empty array), the full service type enum SHALL be shown.

#### Scenario: Machine with supported service types selected
- **WHEN** user selects a machine whose catalog profile has `supportedServiceTypes: ["commissioning", "maintenance"]`
- **THEN** the service type dropdown shows only "Commissioning" and "Maintenance"
- **AND** other service types are hidden from the dropdown

#### Scenario: Machine without supported service types
- **WHEN** user selects a machine whose catalog profile has `supportedServiceTypes: null` or `[]`
- **THEN** the service type dropdown shows all service types (no filtering)

#### Scenario: No machine selected
- **WHEN** no machine is selected on the ticket form
- **THEN** the service type dropdown shows all service types

#### Scenario: Current service type not supported by new machine
- **WHEN** user changes the machine selection
- **AND** the currently selected service type is not in the new machine's `supportedServiceTypes`
- **THEN** the service type field SHALL be cleared (reset to empty)
- **AND** the user must re-select a valid service type

#### Scenario: Current service type is supported by new machine
- **WHEN** user changes the machine selection
- **AND** the currently selected service type IS in the new machine's `supportedServiceTypes`
- **THEN** the service type selection remains unchanged

---

### Requirement: Supported service types shown in machine hints

The machine hints panel SHALL display the supported service types from the machine profile, so the user can see at a glance what service types apply to this machine.

#### Scenario: Machine profile has supported service types
- **WHEN** a machine is selected and its profile has `supportedServiceTypes`
- **THEN** the machine hints panel shows a "Supported service types" line listing the translated type names

#### Scenario: Machine profile has no supported service types
- **WHEN** a machine is selected and its profile has no `supportedServiceTypes`
- **THEN** the "Supported service types" line is not shown in the hints panel

---

### Requirement: Part recommendations filtered by service type

Recommended parts in the machine hints panel SHALL be filtered by the selected service type, using the mapping between ticket service types and part template `service_context` values.

The mapping SHALL be:
| Ticket `service_type` | Template `service_context` |
|---|---|
| `commissioning` | `startup` |
| `regular` | `repair` |
| `warranty_claim` | `reclamation` |
| `maintenance` | `preventive` |

#### Scenario: Service type selected — filter parts
- **WHEN** a machine is selected AND a service type is selected
- **THEN** the recommended parts list shows only part templates whose `service_context` matches the selected service type (per the mapping above)

#### Scenario: No service type selected — show all parts
- **WHEN** a machine is selected but no service type is selected
- **THEN** the recommended parts list shows all part templates for that machine (no service_context filter)

#### Scenario: Service type changed — parts refresh
- **WHEN** user changes the service type while a machine is selected
- **THEN** the recommended parts list re-fetches with the new `serviceContext` filter
- **AND** the parts list updates to show only matching templates

---

### Requirement: MachineProfileRecord includes supportedServiceTypes

The `machineOptions.ts` parser SHALL extract `supportedServiceTypes` from the machine profile API response and include it in the `MachineProfileRecord` type.

#### Scenario: Profile has supported service types
- **WHEN** the machine profile API returns `supported_service_types: ["commissioning", "maintenance"]`
- **THEN** `MachineProfileRecord.supportedServiceTypes` is `["commissioning", "maintenance"]`

#### Scenario: Profile has null supported service types
- **WHEN** the machine profile API returns `supported_service_types: null`
- **THEN** `MachineProfileRecord.supportedServiceTypes` is `null`

---

## 3c. Capability: service-tickets (MODIFIED)

### Requirement: Backend UI Pages (MODIFIED)

Three pages implemented:

| Page | Path | Auth |
|---|---|---|
| List | `/backend/service-tickets` | `service_tickets.view` |
| Create | `/backend/service-tickets/create` | `service_tickets.create` |
| Edit | `/backend/service-tickets/[id]/edit` | `service_tickets.edit` |

The edit page SHALL include a parts management section below the ticket form. Parts are managed independently from the ticket form — each add/edit/delete operation saves immediately via the parts API.

The create page does not include a parts section (parts require an existing `ticket_id`).

The service type dropdown on both create and edit pages SHALL be filtered by the selected machine's supported service types when a machine is selected.

#### Scenario: Edit page displays parts section
- **WHEN** user navigates to the ticket edit page
- **THEN** the ticket form is shown at the top
- **AND** a parts management section is shown below the form
- **AND** parts load independently from the ticket data

#### Scenario: Service type dropdown respects machine on edit page
- **WHEN** user edits a ticket with a machine selected
- **THEN** the service type dropdown is filtered to the machine's supported service types

#### Scenario: Service type dropdown respects machine on create page
- **WHEN** user selects a machine on the create page
- **THEN** the service type dropdown is filtered to the machine's supported service types

---

# 4. Implementation Tasks

## 1. Data Layer — Extend machineOptions.ts Parsers

- [ ] 1.1 Add `partCatalogProductId` field to `MachinePartTemplateRecord` type and update `toMachinePartTemplateRecord` parser to extract `partCatalogProductId` / `part_catalog_product_id`
- [ ] 1.2 Add `supportedServiceTypes` field to `MachineProfileRecord` type and update `toMachineProfileRecord` parser to extract `supportedServiceTypes` / `supported_service_types` (as `string[] | null`)
- [ ] 1.3 Add `serviceTypeToServiceContext` mapping constant (`commissioning→startup`, `regular→repair`, `warranty_claim→reclamation`, `maintenance→preventive`) — place in `machineOptions.ts` or a shared constants file
- [ ] 1.4 Update `fetchMachinePartTemplates` to accept optional `serviceContext` parameter and pass it to the API query string when provided

## 2. Service Type Filtering by Machine

- [ ] 2.1 Add `onSupportedServiceTypesChange` callback prop to `MachineCascadeSelect` — called with `string[] | null` when machine profile loads
- [ ] 2.2 In `MachineCascadeSelect`, call `onSupportedServiceTypesChange` when profile loads (passing `profile.supportedServiceTypes`) and when machine is cleared (passing `null`)
- [ ] 2.3 Display supported service types in the machine hints panel (translated names, below service notes)
- [ ] 2.4 In `ticketFormConfig.tsx`, wire `onSupportedServiceTypesChange` to filter the service type field options — store `supportedServiceTypes` in component state, filter `SERVICE_TYPE_VALUES` when rendering
- [ ] 2.5 When supported types change and current `service_type` value is not in the new list, clear the `service_type` field via `setValue('service_type', '')`

## 3. Part Recommendations Filtered by Service Type

- [ ] 3.1 Add `serviceType` prop to `MachineCascadeSelect` (the current ticket service_type value)
- [ ] 3.2 When `serviceType` or `selectedMachine` changes, re-fetch part templates with the mapped `serviceContext` filter (use the mapping from 1.3). When `serviceType` is empty, fetch without filter.
- [ ] 3.3 Update the `useEffect` that loads hints to depend on `serviceType` and pass the serviceContext param to `fetchMachinePartTemplates`

## 4. One-Click Add Part from Recommendations

- [ ] 4.1 Add `onAddPart` callback prop to `MachineCascadeSelect` — signature: `(template: MachinePartTemplateRecord) => void`
- [ ] 4.2 Render a "+" `IconButton` next to each recommended part that has a `partCatalogProductId`. Hide the button for templates without it.
- [ ] 4.3 On click, call `onAddPart(template)` — the parent handles the API call

## 5. Ticket Parts Section Component

- [ ] 5.1 Create `TicketPartsSection` component in `src/modules/service_tickets/components/TicketPartsSection.tsx` — accepts `ticketId: string` prop
- [ ] 5.2 On mount, fetch parts via `GET /api/service_tickets/parts?ticket_id={ticketId}&sortField=created_at&sortDir=asc` using `readApiResultOrThrow`
- [ ] 5.3 Render parts as a table: columns for part name, quantity, notes, actions (edit/delete). Show empty state when no parts.
- [ ] 5.4 Part name resolution: maintain a `Map<string, MachinePartTemplateRecord>` keyed by `partCatalogProductId`. Populate from the machine hints templates (passed as prop or fetched). Fallback to truncated UUID for unresolvable IDs.
- [ ] 5.5 Implement delete: call `DELETE /api/service_tickets/parts?id={partId}`, then re-fetch the parts list
- [ ] 5.6 Implement inline edit: clicking edit makes quantity/notes fields editable. Save calls `PUT /api/service_tickets/parts` with `id`, `quantity`, `notes`. Escape cancels and reverts.
- [ ] 5.7 Expose `addPart(template: MachinePartTemplateRecord)` method (via ref or callback registration) that calls `POST /api/service_tickets/parts` with `ticket_id`, `product_id` from `template.partCatalogProductId`, `quantity` from `template.quantityDefault` (default 1), then re-fetches the list

## 6. Wire Everything into the Edit Page

- [ ] 6.1 In `edit/page.tsx`, render `TicketPartsSection` below the `CrudForm`, passing the ticket `id`
- [ ] 6.2 Wire `MachineCascadeSelect.onAddPart` through to `TicketPartsSection.addPart` — use a shared ref or callback state lifted to the edit page
- [ ] 6.3 Pass the current `service_type` form value to `MachineCascadeSelect` as `serviceType` prop so part recommendations filter correctly

## 7. Translations

- [ ] 7.1 Add EN/PL translation keys for the parts section: section title, empty state, column headers (name, quantity, notes, actions), add/edit/save/cancel/delete button labels, loading state
- [ ] 7.2 Add EN/PL translation keys for machine hints: "Supported service types" label
- [ ] 7.3 Add EN/PL translation keys for add-from-recommendation button tooltip

## 8. Testing

- [ ] 8.1 Unit test for `serviceTypeToServiceContext` mapping — verify all four mappings and edge cases (unknown type returns undefined)
- [ ] 8.2 Unit test for updated `toMachineProfileRecord` — verify `supportedServiceTypes` extraction for array, null, and missing cases
- [ ] 8.3 Unit test for updated `toMachinePartTemplateRecord` — verify `partCatalogProductId` extraction
- [ ] 8.4 Manual test: select machine with `supportedServiceTypes` → verify service type dropdown filters, verify clearing machine restores full dropdown
- [ ] 8.5 Manual test: select machine + service type → verify part recommendations filter by service context
- [ ] 8.6 Manual test: click "+" on recommended part → verify part appears in parts section, verify parts CRUD (edit quantity, delete)

---

# Key Files Reference

| File | Role |
|---|---|
| `src/modules/service_tickets/components/machineOptions.ts` | Machine/profile/part-template fetch + parsing |
| `src/modules/service_tickets/components/MachineCascadeSelect.tsx` | Machine selector + hints panel |
| `src/modules/service_tickets/components/ticketFormConfig.tsx` | Form field/group definitions |
| `src/modules/service_tickets/backend/service-tickets/[id]/edit/page.tsx` | Ticket edit page |
| `src/modules/service_tickets/api/parts/route.ts` | Parts CRUD API |
| `src/modules/service_tickets/commands/parts.ts` | Parts command handlers |
| `src/modules/service_tickets/data/validators.ts` | Zod schemas (part create/update) |
| `src/modules/service_tickets/data/entities.ts` | ServiceTicketPart entity |
| `src/modules/machine_catalog/data/entities.ts` | MachineCatalogProfile + MachineCatalogPartTemplate entities |
| `src/modules/machine_catalog/api/part-templates/route.ts` | Part templates API (supports serviceContext filter) |
