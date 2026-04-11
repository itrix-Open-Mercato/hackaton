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

### 1. Parts section below the CrudForm on the edit page

Add a `TicketPartsSection` component rendered below the `CrudForm` on the edit page. This avoids fighting CrudForm's field/group system which doesn't support sub-resource CRUD tables.

**Alternative considered:** Embedding parts inside a CrudForm custom field group. Rejected because CrudForm submit would try to serialize parts state, and parts have their own independent API lifecycle (separate create/update/delete calls).

### 2. MachineCascadeSelect gets an `onAddPart` callback

Add an `onAddPart(template: MachinePartTemplateRecord)` prop to `MachineCascadeSelect`. Each recommended part in the hints panel gets a "+" button. When clicked, it calls `onAddPart` with the template data. The parent (`TicketPartsSection` or the edit page) handles the actual API call and list refresh.

**Alternative considered:** Having `MachineCascadeSelect` call the parts API directly. Rejected because it would couple the machine component to the parts API and make it harder to show optimistic updates in the parts list.

### 3. Parts list as a simple table with inline actions

Render parts as a lightweight `<table>` with columns: part name, quantity, notes, and action buttons (edit/delete). No pagination needed (parts per ticket are typically < 20).

For editing: inline quantity/notes editing with a save button, not a modal dialog. Keeps interactions fast.

### 4. Product name resolution via enrichment

The parts API returns `product_id` (UUID) but no product name. Two options:
- (a) Fetch catalog product names client-side by ID after loading parts
- (b) Store `product_name` snapshot on `ServiceTicketPart` entity

**Decision:** Option (a) — fetch product names client-side by calling `/api/machine_catalog/part-templates?ids=...` to resolve names. This avoids a migration and keeps the parts table normalized. The part templates already contain `part_name` and `part_code`. For parts added from recommendations, we can cache the template data locally since we already have it from the machine hints fetch.

**Fallback:** If a part's `product_id` doesn't match any template (manual API entry), show the UUID truncated. This is acceptable for hackathon scope.

### 5. Wiring: edit page orchestrates state

The edit page becomes the coordinator:
1. Loads ticket data (existing flow)
2. Renders `CrudForm` for ticket fields (existing flow)
3. Renders `TicketPartsSection` below, passing `ticketId`
4. `TicketPartsSection` fetches parts list on mount
5. `MachineCascadeSelect` gets `onAddPart` — bubbled up from `TicketPartsSection` through form config
6. When a recommended part is added, `TicketPartsSection` calls POST `/api/service_tickets/parts` and refreshes

### 6. MachinePartTemplateRecord needs partCatalogProductId

The `machineOptions.ts` parser currently omits `partCatalogProductId` from `MachinePartTemplateRecord`. We need to include it so the "add to ticket" action knows which `product_id` to send. Templates without a `partCatalogProductId` (manually entered names only) won't get an "add" button.

### 7. Service type driven by machine profile

When a machine is selected on the ticket form:
1. The machine hints fetch already loads the `MachineCatalogProfile`
2. Expose `supportedServiceTypes` from the profile record (already in the API response as `supported_service_types`, but not parsed by `machineOptions.ts`)
3. Pass the supported types back up to the form so the service type `<select>` filters its options
4. If the currently selected service type is not in the machine's supported list, clear it (force re-selection)
5. When no machine is selected, show the full enum (backward-compatible)

**Alternative considered:** Making service type a property of the machine instance rather than the profile. Rejected because service types are a characteristic of the machine model (catalog), not the individual installed unit.

### 8. Part recommendations filtered by service type

The part templates API already supports a `serviceContext` query parameter. When the user selects both a machine and a service type:
1. Re-fetch part templates with `serviceContext` filter matching the ticket's service type
2. The mapping between ticket `service_type` values and part template `service_context` values needs a lookup table (they use different terms: `commissioning` → `startup`, `maintenance` → `preventive`, `warranty_claim` → `reclamation`, `regular` → `repair`)

**Alternative considered:** Filtering client-side from the full list. Rejected because the API already supports server-side filtering, and it's cleaner. Also, a machine could have many part templates across all contexts — server filtering avoids over-fetching.

### 9. Service type ↔ service context mapping

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
