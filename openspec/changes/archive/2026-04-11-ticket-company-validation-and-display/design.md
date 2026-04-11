## Context

Service tickets store `customerEntityId` (company) and `contactPersonId` (person) as plain UUID foreign keys into the customers module. The form UI already cascades these via `CustomerCascadeSelect` — changing company clears and reloads the person dropdown. However, no server-side validation ensures the contact person actually belongs to the selected company. The ticket list table shows status, type, priority, and dates but not the company name, and has no company filter despite the API already accepting `customer_entity_id` as a query parameter.

Key existing files:
- `commands/tickets.ts` — create/update commands, staff assignment logic
- `api/tickets/route.ts` — list endpoint with `buildFilters`, `transformItem`; already supports `customer_entity_id` filter param
- `components/ServiceTicketsTable.tsx` — tanstack react-table columns, filter config
- `components/CustomerCascadeSelect.tsx` — company→person cascade (already works)
- `data/validators.ts` — Zod schemas for create/update

## Goals / Non-Goals

**Goals:**
- Server-side validation that `contactPersonId` belongs to `customerEntityId` on create and update
- Display company name column in the ticket list table
- Add company filter dropdown to the ticket list table
- Unit tests for the validation logic

**Non-Goals:**
- Changing the existing `CustomerCascadeSelect` form behavior (already works correctly)
- Adding company-based access control (tickets visible across companies within same org)
- Caching company name lookups (premature for hackathon scale)

## Decisions

### 1. Validate contact-person membership in command layer, not Zod schema

**Decision:** Add validation logic inside `createTicketCommand.execute()` and `updateTicketCommand.execute()` rather than as a Zod `.refine()`.

**Why:** The validation requires an async API call to the customers module (`/api/customers/companies/{id}?include=people`). Zod refinements support async but the existing schemas are used synchronously with `.parse()`. Changing to `.parseAsync()` would touch every call site. Keeping validation in the command layer matches the existing pattern where business rules (ticket number generation, date change tracking, staff assignment diffing) live in commands.

**Alternatives considered:**
- Zod `.refine()` with `.parseAsync()` — cleaner separation but requires changing all parse call sites
- API interceptor — too generic for a single-entity business rule

**Implementation:** Extract a `validateContactPersonBelongsToCompany(contactPersonId, customerEntityId, ctx)` helper function in `commands/tickets.ts`. It fetches the company's people list and checks membership. Throws `CrudHttpError(422, ...)` on mismatch.

### 2. Use response enricher for company name in list view

**Decision:** Create `data/enrichers.ts` implementing `ResponseEnricher` to batch-resolve company names for the ticket list.

**Why:** The enricher pattern is the framework's intended way to augment API responses with cross-module data. It handles batching automatically (`enrichMany`) avoiding N+1 queries. The `ServiceTicketsTable` can then read the enriched `companyName` field directly from the API response without client-side fetching.

**Alternatives considered:**
- Client-side lookup per row — N+1 requests on every page load
- JOIN in the list query — violates cross-module boundary rule (no direct ORM relationships between modules)

**Implementation:**
- `enrichOne`: fetch single company name via customers API
- `enrichMany`: batch-fetch all unique `customerEntityId` values, build a name map, merge into response records
- Enrichment key: `_service_tickets.companyName`

### 3. Company filter uses async ComboboxInput pattern

**Decision:** The company filter in the table will be an async searchable dropdown that queries `/api/customers/companies?search=`, matching the pattern already used in `CustomerCascadeSelect`.

**Why:** Companies are an open-ended set — a static `select` with predefined options won't work. The `customer_entity_id` query parameter is already supported by the list API route (`route.ts:25`), so only the UI filter component needs to be added.

**Alternatives considered:**
- Static select with preloaded companies — doesn't scale, stale data
- Free-text input — poor UX, requires knowing exact company ID

### 4. Test scope: command validation + API route filter

**Decision:** Write unit tests for:
1. The `validateContactPersonBelongsToCompany` helper — all 6 spec scenarios
2. The API route's `transformItem` including the new `companyName` enriched field

**Why:** Command/validator tests catch the most bugs per minute (per project conventions). The enricher and table column are wiring that's harder to unit test and easier to verify visually.

## Risks / Trade-offs

**[Risk] Customers API unavailable** → The validation call and enricher both depend on the customers module API. If it's down, ticket creation fails and list shows empty company names.
→ *Mitigation:* Enricher has a `fallback` value (empty string). Validation failure on API error should return a clear error message, not a 500.

**[Risk] Stale people list in validation** → Between loading the form and submitting, a person could be removed from a company.
→ *Mitigation:* Acceptable for hackathon. The server-side check at submit time is the source of truth.

**[Trade-off] Extra API call per save** → Each create/update makes one additional request to `/api/customers/companies/{id}?include=people`.
→ *Acceptable:* Single request, small payload, hackathon scale. Could add caching later if needed.

**[Trade-off] Enricher adds latency to list** → Batch company name lookup adds one API call per list page load.
→ *Acceptable:* Single batched request for all unique company IDs on the page. Negligible at ≤50 rows per page.
