# Field Technicians Module

## TLDR

**Key Points:**
- A standalone app-level module (`apps/mercato/src/modules/field_technicians/`) providing a profile card ("Karta Serwisanta") for each service technician with identity, contact, skills, certifications, current location status, and soft cross-module references to staff profiles and fleet vehicles.
- Two entities: `FieldTechnician` (profile) and `FieldTechnicianCertification` (per-technician certificates and permissions with expiry tracking).
- Skills and languages are stored as free-form tag arrays on the profile; they are the primary matching surface for order dispatch and assignment flows.
- Cross-module references to staff members and fleet vehicles are stored as plain FK IDs — no ORM joins, in line with the platform no-cross-module-ORM rule.
- Phase 1 (current branch) delivers the full CRUD core: entities, commands, API, backend UI, search indexing, events, and ACL. Availability calendar, spare-parts inventory, document management, and service history belong to later phases.

**Scope (Phase 1 — current):**
- `FieldTechnician` entity with location status, skills, languages, external links
- `FieldTechnicianCertification` sub-entity with expiry and renewal tracking
- CRUD API with `openApi`, filtering, sorting, search index integration
- Undoable commands for all write operations
- Backend list, create, and detail/edit pages with certification management tab
- Event declarations for CRUD side effects
- ACL feature declarations and default role assignments

**Scope (Phase 2 — planned):**
- Availability calendar integration (link to scheduling / Grafik module)
- Spare-parts handtools inventory (link to warehouse module)
- Service history timeline per technician
- Employee document management (file attachments: medical certificates, uploaded permits)

**Concerns:**
- Skills tag array is the matching surface for order dispatch; the format (free-form vs. dictionary) must be consistent across the assignment picker and the technician list filter.
- Cross-module links (`staffMemberId`, `vehicleId`) are nullable FK IDs. The linked modules may not be installed in every deployment; the UI must handle absent targets gracefully.
- Certification expiry warnings (30-day threshold) are currently computed client-side; if server-side alerting is needed, a subscriber or background worker must be added in Phase 2.

## Overview

The Field Technicians module provides a lightweight "technician card" (Karta Serwisanta) for service organisations dispatching technicians to client sites.  Each card aggregates the information an order dispatcher needs before assigning a technician to a work order: identity, current location status, competency tags, language skills, certifications with expiry dates, a link to the staff HR profile, and a default vehicle reference.

The module lives in `apps/mercato/src/modules/field_technicians/` — the user-app module directory — because it is a domain-specific extension for a particular customer's service-dispatch workflow, not a reusable platform primitive.  It follows the same structural patterns as core modules: `makeCrudRoute`, undoable commands, `CrudForm`/`DataTable` UI, `createModuleEvents`, and feature-based RBAC.

## Problem Statement

Service companies managing field technicians face a recurring coordination problem: when a new work order arrives, the dispatcher must answer several questions simultaneously —

- Is the technician available right now (in office / on trip / at client / unavailable)?
- Does the technician hold the required certifications (e.g. SEP electrical safety, driving licence category) and are they still valid?
- Does the technician have the right technical skills (laser, CNC, heat pump, air conditioning…)?
- Which vehicle is the technician using, and which HR record represents them in the payroll/HR system?

Without a dedicated technician profile store, this information is scattered across spreadsheets, HR systems, and memory.  The module centralises it in a single queryable record that order dispatch flows can reference.

## Proposed Solution

Introduce a `field_technicians` module at the app level containing:

1. A `FieldTechnician` entity that acts as the canonical profile card.
2. A `FieldTechnicianCertification` child entity for document-backed permits and licences.
3. Standard CRUD API routes with `openApi` following `makeCrudRoute` conventions.
4. Undoable commands for all mutations.
5. Full-text search indexing on the profile fields most useful for dispatcher lookup.
6. RBAC with two features: `view` (read-only) and `manage` (full write access).
7. Backend pages for list, create, and detail/edit, including an inline certification management tab.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `FieldTechnicianCertification` entity, not a jsonb blob | Certifications need individual expiry dates, renewal tracking, and per-record delete — a flat array of jsonb objects cannot support targeted soft-delete or sorted expiry queries |
| Skills and languages as `jsonb string[]` on the profile | Skills are free-form tags used for filtering; no FK relationship needed; dispatcher can type arbitrary specialisation labels |
| `staffMemberId` and `vehicleId` as nullable FK IDs (no ORM join) | Linked modules may not be present in every deployment; decoupled references follow platform no-cross-module-ORM rule |
| `vehicleLabel` denormalised on the technician record | Display name of the vehicle at link time — prevents a live join to the fleet module just to render the label |
| Module placed in `apps/mercato/src/modules/` | Domain-specific customer extension, not a platform-wide primitive; follows monorepo placement rules |
| Location status as an enum text column with a typed union | Finite set of statuses; avoids a separate dictionary table for a four-value set |
| Certification expiry warnings at 30 days computed client-side (Phase 1) | Sufficient for the initial UI; server-side alerting via a subscriber is a Phase 2 addition |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Store certifications as a `jsonb[]` column on `FieldTechnician` | Cannot soft-delete individual certs, cannot index/sort expiry, harder to extend with document uploads in Phase 2 |
| Store skills as a foreign-key linked dictionary | Over-engineering for free-form tags; adding a skills dictionary is a Phase 2 option if normalisation becomes needed |
| Place the module in `packages/core` | It is customer-specific, not a platform primitive; core is reserved for features all deployments may need |

## User Stories / Use Cases

- **Dispatcher** needs to find all technicians with `heat pump` skill who are currently `in_office` and hold a valid SEP certificate before assigning a work order.
- **Admin** needs to create and update technician profiles and manage which certifications are on file.
- **HR manager** needs to see a warning when a technician's driving licence or SEP permit is expiring within 30 days.
- **Dispatcher** wants to click through from a technician card to the staff HR profile or fleet vehicle entry without re-searching in another module.
- **Technician supervisor** wants to see at a glance all expired or expiring-soon certifications across the team (Phase 2: dashboard widget).

## Architecture

Module path: `apps/mercato/src/modules/field_technicians/`

The module follows standard app-level module conventions (identical patterns to core CRUD modules):

- **Entities** (`data/entities.ts`): MikroORM entities — `FieldTechnician`, `FieldTechnicianCertification`
- **Validators** (`data/validators.ts`): Zod schemas with `z.infer<>` derived types
- **Commands** (`commands/technicians.ts`, `commands/certifications.ts`): undoable command handlers registered via `registerCommand`
- **API routes** (`api/field-technicians/route.ts`, `api/field-technicians/certifications/route.ts`): `makeCrudRoute` + `openApi`
- **Backend pages** (`backend/field-technicians/`): list, create, detail/edit with certification tab
- **Events** (`events.ts`): typed CRUD events via `createModuleEvents`
- **ACL** (`acl.ts`): two features declared, defaults in `setup.ts`
- **Search** (`search.ts`): fulltext index on key lookup fields
- **i18n** (`i18n/en.json`, `i18n/pl.json`): all user-facing strings externalised

### Commands

| Command ID | Purpose |
|------------|---------|
| `field_technicians.technicians.create` | Create new technician profile (undoable) |
| `field_technicians.technicians.update` | Update technician profile fields (undoable) |
| `field_technicians.technicians.delete` | Soft-delete technician profile (undoable) |
| `field_technicians.certifications.create` | Add a certification record to a technician (undoable) |
| `field_technicians.certifications.update` | Update an existing certification record (undoable) |
| `field_technicians.certifications.delete` | Soft-delete a certification record (undoable) |

### Events

Declared via `createModuleEvents` with `as const` in `events.ts`:

| Event ID | Trigger |
|----------|---------|
| `field_technicians.field_technician.created` | Technician profile created |
| `field_technicians.field_technician.updated` | Technician profile updated |
| `field_technicians.field_technician.deleted` | Technician profile soft-deleted |
| `field_technicians.certification.created` | Certification record added |
| `field_technicians.certification.updated` | Certification record updated |
| `field_technicians.certification.deleted` | Certification record removed |

## Data Models

### FieldTechnician
Table: `field_technicians`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `organization_id` | uuid | no | tenant scoping |
| `tenant_id` | uuid | no | tenant scoping |
| `display_name` | text | no | full name for display; required |
| `first_name` | text | yes | |
| `last_name` | text | yes | |
| `email` | text | yes | |
| `phone` | text | yes | |
| `location_status` | text | no | `in_office` \| `on_trip` \| `at_client` \| `unavailable`; default `in_office` |
| `skills` | jsonb | no | `string[]`; free-form specialisation tags; default `[]` |
| `languages` | jsonb | no | `string[]`; communication languages; default `[]` |
| `notes` | text | yes | free-form internal notes |
| `staff_member_id` | uuid | yes | FK ref to staff module — no ORM join |
| `vehicle_id` | uuid | yes | FK ref to fleet module — no ORM join |
| `vehicle_label` | text | yes | denormalised vehicle display name |
| `current_order_id` | uuid | yes | FK ref to currently assigned work order |
| `is_active` | boolean | no | default `true` |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `deleted_at` | timestamptz | yes | soft-delete |

Indexes:
- `(tenant_id, organization_id)` — tenant scoping
- `(tenant_id, organization_id, is_active)` — active filter

### FieldTechnicianCertification
Table: `field_technician_certifications`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `organization_id` | uuid | no | |
| `tenant_id` | uuid | no | |
| `technician_id` | uuid | no | FK ref to `field_technicians.id` |
| `name` | text | no | certificate / permit name |
| `cert_type` | text | yes | `sep` \| `driving_license` \| `other` |
| `code` | text | yes | certificate number / permit code |
| `issued_at` | date | yes | |
| `expires_at` | date | yes | used for expiry sorting and 30-day warning |
| `issued_by` | text | yes | issuing authority |
| `notes` | text | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `deleted_at` | timestamptz | yes | soft-delete |

Indexes:
- `(technician_id)` — lookup by technician
- `(tenant_id, organization_id)` — tenant scoping
- `(tenant_id, organization_id, expires_at)` — expiry sorted queries

## API Contracts

All routes export `openApi`.

### Technician CRUD

#### `GET /api/field-technicians`
Query parameters:
- `page`, `pageSize` (max 100, default 50)
- `search` — `$ilike` across `display_name`, `email`, `phone`
- `locationStatus` — exact match filter
- `isActive` — boolean string (`true`/`false`)
- `ids` — comma-separated UUID list for batch lookup
- `sortField` — one of `id`, `display_name`, `location_status`, `email`, `is_active`, `created_at`; default `display_name`
- `sortDir` — `asc` | `desc`; default `asc`

Response: paged list of technician rows (all non-sensitive fields).

#### `POST /api/field-technicians`
Body: `FieldTechnicianCreateInput` (validated by Zod schema)
Response: `{ id: string }` — 201

Required fields: `tenantId`, `organizationId`, `displayName`

Optional fields: `firstName`, `lastName`, `email`, `phone`, `locationStatus`, `skills`, `languages`, `notes`, `staffMemberId`, `vehicleId`, `vehicleLabel`, `currentOrderId`, `isActive`

#### `PUT /api/field-technicians`
Body: `FieldTechnicianUpdateInput` — must include `id`; all other fields optional patch semantics
Response: `{ ok: true }`

#### `DELETE /api/field-technicians?id=<uuid>`
Soft-deletes the technician profile.
Response: `{ ok: true }`

### Certification CRUD

#### `GET /api/field-technicians/certifications`
Query parameters:
- `page`, `pageSize` (max 100, default 50)
- `technicianId` — filter by parent technician UUID
- `ids` — comma-separated UUID list
- `sortField` — one of `id`, `name`, `expires_at`, `issued_at`, `created_at`; default `name`
- `sortDir` — `asc` | `desc`; default `asc`

Response: paged list of certification rows, dates serialised as ISO 8601 strings.

#### `POST /api/field-technicians/certifications`
Body: `FieldTechnicianCertificationCreateInput`
Required: `tenantId`, `organizationId`, `technicianId`, `name`
Response: `{ id: string }` — 201

#### `PUT /api/field-technicians/certifications`
Body: `FieldTechnicianCertificationUpdateInput` — must include `id`
Response: `{ ok: true }`

#### `DELETE /api/field-technicians/certifications?id=<uuid>`
Soft-deletes the certification record.
Response: `{ ok: true }`

### Route Auth Guards

| Method | Required feature |
|--------|----------------|
| `GET` | `field_technicians.view` |
| `POST` | `field_technicians.manage` |
| `PUT` | `field_technicians.manage` |
| `DELETE` | `field_technicians.manage` |

## ACL & Feature IDs

Declared in `acl.ts`, defaults in `setup.ts`:

| Feature ID | Purpose | Default roles |
|------------|---------|---------------|
| `field_technicians.view` | View technician list and profiles | `admin`, `employee` |
| `field_technicians.manage` | Create, edit, and delete technicians and certifications | `admin` |

The wildcard `field_technicians.*` is assigned to `admin`, which covers both declared features and any future additions.

## Search Indexing

Search entity type: `field_technicians:field_technician`
Detail URL: `/backend/field-technicians/:id`

| Field | Weight |
|-------|--------|
| `display_name` | 10 |
| `first_name` | 8 |
| `last_name` | 8 |
| `email` | 6 |
| `phone` | 4 |

Result format: `{ title: display_name, subtitle: email ?? phone }`

## Internationalization (i18n)

i18n keys are externalised in `i18n/en.json` and `i18n/pl.json`.  Sections covered:

- Navigation and page titles
- List column headers
- Location status labels and badge colours
- Form field labels, placeholders, and group titles
- Certification form fields and status labels (Expired, Expiring soon)
- Flash messages (created, updated, deleted, cert added, cert removed)
- Confirm dialog copy for destructive actions
- Audit log action labels

## UI / UX

### Backend Routes
- `/backend/field-technicians` — technician list (`DataTable`)
- `/backend/field-technicians/create` — create new technician (`CrudForm`)
- `/backend/field-technicians/[id]` — technician card with tabs: Overview, Certifications & Permissions, Edit profile

### Technician List
- Columns: display name, location status (coloured badge), email, skills (tag chips), is_active
- Filters: search, location status, active/inactive
- Row action: navigate to detail page

### Technician Detail — Overview Tab
Two-column layout:
- Left: Contact & Identity (email, phone, vehicle, current assignment)
- Left: Notes
- Right: Skills & Specializations (tag chips)
- Right: Languages (tag chips)
- Right: Current location (coloured status badge)
- Right: Linked modules section (link to staff profile, link to availability calendar panel) — shown only when `staffMemberId` is present

### Technician Detail — Certifications Tab
- Add certification button opens an inline `CrudForm` panel
- Certification cards sorted by `expires_at` ascending
- Visual states per card:
  - `expired` — red destructive border + Expired badge
  - `expiringSoon` (≤30 days) — amber border + Expiring soon badge
  - otherwise — neutral card
- Per-card fields: name, cert_type badge, code, issued_at, expires_at, issued_by, notes
- Delete action per card with confirm dialog

### Technician Detail — Edit Profile Tab
- `CrudForm` with groups:
  - Identity: `display_name`, `first_name`, `last_name`
  - Contact: `email`, `phone`
  - Status: `location_status`, `is_active`
  - Competencies: `skills` (tags), `languages` (tags)
  - Notes: `notes`
- `Cmd/Ctrl+Enter` to submit, `Escape` to cancel

## Implementation Plan

### Phase 1 — Core (current branch: `feature/field-technicians-ui-fixes`)
Complete:
1. `data/entities.ts` — `FieldTechnician` and `FieldTechnicianCertification` MikroORM entities
2. `data/validators.ts` — Zod create/update schemas
3. `lib/crud.ts` — shared CRUD event and entity type constants
4. `commands/technicians.ts` — create / update / delete with undo support
5. `commands/certifications.ts` — create / update / delete with undo support
6. `api/field-technicians/route.ts` — CRUD route with `openApi`
7. `api/field-technicians/certifications/route.ts` — CRUD route with `openApi`
8. `backend/field-technicians/page.tsx` — list page
9. `backend/field-technicians/create/page.tsx` — create page
10. `backend/field-technicians/[id]/page.tsx` — detail / edit / certs page
11. `events.ts` — typed event declarations
12. `acl.ts` and `setup.ts` — features and default role assignments
13. `search.ts` — search indexing configuration
14. `i18n/en.json` and `i18n/pl.json` — translations
15. Module registered in `apps/mercato/src/modules.ts`
16. DB migration generated

### Phase 2 — Availability & Inventory
1. Link to scheduling/Grafik module: calendar availability panel on detail page
2. Spare-parts handtools inventory: link to warehouse module, per-technician stock display
3. Service history timeline: list of completed work orders per technician (sourced from orders module)
4. Expiry alert subscriber: server-side notification when a certification expires or reaches the 30-day threshold
5. Dashboard widget: certifications expiring this month across the team

### Phase 3 — Document Management
1. Employee document attachments: upload and manage scanned certificates, medical clearances
2. Document store integration: file storage linked to `FieldTechnicianCertification` records

## Testing Strategy

### Integration Coverage (Phase 1)

Required scenarios:
- Create a technician with minimum required fields; verify response `id` and list retrieval
- Create a technician with all optional fields including skills and languages; verify data round-trip
- Update a technician's `locationStatus`; verify updated value in GET response
- Soft-delete a technician; verify record disappears from default list but is retrievable with deleted filter
- Add a certification to a technician; verify `technicianId` linkage and response
- Update a certification's `expires_at`; verify updated value
- Soft-delete a certification; verify removal from default list
- Filter technicians by `locationStatus`; verify only matching records returned
- Filter certifications by `technicianId`; verify only that technician's certs returned
- Search by display name partial match; verify search hit
- Verify `field_technicians.view` feature required for GET; return 403 without it
- Verify `field_technicians.manage` feature required for POST/PUT/DELETE; return 403 without it
- Verify tenant scoping: technician created in tenant A is not visible in tenant B

### Non-Functional Checks
- `pageSize` capped at 100 on both routes
- All mutations validated with Zod; invalid body returns 400
- `organization_id` filter applied on all queries
- No raw `fetch` in backend pages

## Risks & Impact Review

#### Skills Format Inconsistency
- **Scenario**: Dispatcher enters `"heat pump"` on one technician and `"Heat Pump"` on another; filter by skill finds only one.
- **Severity**: Medium
- **Affected area**: Order assignment, technician filtering
- **Mitigation**: Normalise tags to lowercase on write in the create/update command; apply `$ilike` filter on skills array queries.
- **Residual risk**: Until normalisation is applied, existing data may have inconsistent casing.

#### Missing Linked Module
- **Scenario**: `staffMemberId` references a staff profile that is not installed or has been deleted; the UI renders a broken link.
- **Severity**: Low
- **Affected area**: Detail page "Linked modules" section
- **Mitigation**: The UI checks `staffMemberId` before rendering the link; the link navigates to the staff module path which will render its own 404 if the record is absent.
- **Residual risk**: No live validation that the referenced staff record still exists.

#### Certification Expiry Alerting Gap
- **Scenario**: A technician's SEP permit expires without a server-side alert; the dispatcher only notices on next manual review.
- **Severity**: Medium
- **Affected area**: Compliance, dispatch safety
- **Mitigation**: Phase 1 provides visual warnings in the UI (30-day and expired states). Phase 2 adds a subscriber-driven notification.
- **Residual risk**: No automated alerting until Phase 2.

#### Tenant Scoping on Certifications
- **Scenario**: A certification query omits `tenant_id` or `organization_id` filter, leaking cross-tenant data.
- **Severity**: Critical
- **Affected area**: Data privacy, multi-tenant isolation
- **Mitigation**: `makeCrudRoute` enforces `orgField` and `tenantField` on every query; no raw SQL in the certifications route.
- **Residual risk**: None identified at spec stage.

## Final Compliance Report — 2026-04-10

### AGENTS.md Files Reviewed
- `AGENTS.md` (root)
- `.ai/specs/AGENTS.md`
- `packages/core/AGENTS.md`

### Compliance Matrix

| Rule | Status | Notes |
|------|--------|-------|
| No direct ORM relationships between modules | Compliant | `staffMemberId`, `vehicleId`, `currentOrderId` are plain FK ID columns |
| Always filter by `organization_id` | Compliant | Both entities include `org_field` in `makeCrudRoute` config |
| Validate all inputs with zod | Compliant | All mutations go through Zod schemas before command execution |
| API routes MUST export `openApi` | Compliant | Both routes export `openApi` via `buildFieldTechniciansCrudOpenApi` |
| Events declared with `createModuleEvents()` | Compliant | `events.ts` uses `createModuleEvents` with `as const` |
| Write operations via Command pattern | Compliant | All mutations routed through registered undoable commands |
| Use `CrudForm` for create/edit | Compliant | Create and edit tab use `CrudForm`; certification inline form also uses `CrudForm` |
| `setup.ts` declares `defaultRoleFeatures` | Compliant | `admin: ['field_technicians.*']`, `employee: ['field_technicians.view']` |
| Module placed correctly in `apps/mercato/src/modules/` | Compliant | App-level customer module, not a platform primitive |
| No `any` types | Compliant | All types derived from Zod schemas or explicit type declarations |
| i18n keys for all user-facing strings | Compliant | `useT()` used client-side; `resolveTranslations()` used in command `buildLog` |

### Non-Compliant Items
- None identified at spec stage.

### Verdict
- **Compliant** — Phase 1 implementation matches spec. Phase 2 items (availability, inventory, document management) require separate spec updates before implementation.

## Changelog

### 2026-04-10
- Initial specification written to document the Phase 1 implementation on branch `feature/field-technicians-ui-fixes`.
- Product requirements source: `.spec/karta_serwisanta.md` (Polish wireframe specification, Module 3).
- Phases 2 and 3 scoped out from the original product spec for future implementation.
