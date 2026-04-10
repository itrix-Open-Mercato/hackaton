# Resources Module — Machine/Asset Extension

## TLDR

Extend the existing `resources` module to serve as a full Customer Machine register. A machine is treated as a Resource with additional identity, ownership, inspection, and component fields. The extension follows a two-level model: **Resource Type** (machine type catalogue) linked to a **CatalogProduct** that owns the technical specification and default component structure, and **Resource** (specific installed unit). Five implementation phases add machine-specific fields, catalog-backed components, inspection scheduling, documentation attachments, and CSV/Excel import.

---

## Overview

**Module:** `packages/core/src/modules/resources/`
**Priority:** High
**Related modules:** `customers`, `catalog`, `attachments`, `dictionaries`, `planner` (availability), `notifications`
**View type:** Asset list + asset card (detail)

The `resources` module already provides resource types, resources, tags, comments, activities, and availability scheduling. This spec extends it to support the full lifecycle of a customer-installed machine: serial number tracking, customer ownership, installation location, warranty status, periodic inspection scheduling with alerts, component-level traceability backed by the catalog product model, documentation inheritance from the machine type, and bulk CSV/Excel import.

---

## Problem Statement

The current `ResourcesResource` entity models a generic schedulable resource (room, person, equipment slot). It lacks the fields needed to register a physical machine installed at a customer site:

- No serial number or unique unit identifier
- No customer ownership link
- No installation address (separate from customer billing address)
- No production or commissioning dates
- No warranty tracking
- No periodic inspection scheduling or overdue alerts
- No component list at the asset level
- No documentation / manual attachment model
- No bulk import capability
- `ResourcesResourceType` has no link to the catalog product that defines the machine type's technical specification and default component structure

---

## Proposed Solution

Treat every machine as a `ResourcesResource` with an extended schema. Extend `ResourcesResourceType` with a `catalogProductId` that points to a `CatalogProduct` — the Product in the catalog module owns the machine type's title, technical specification (description / metadata), and default component list (via `CatalogProductVariantRelation` with `relationType: 'component'`). Asset-level components (`ResourcesResourceComponent`) are unit-specific rows that each reference a catalog product or variant. Introduce inspection scheduling as computed fields on the resource. Wire attachments via injection widgets. Add a CSV/Excel import pipeline.

No new top-level module is created — all changes live within `packages/core/src/modules/resources/`.

---

## Architecture

### Two-level model

```
CatalogProduct  (machine type definition — lives in catalog module)
  └─ title, description, metadata  (technical specification)
  └─ CatalogProductVariantRelation[]  relationType: 'component'  (default component list)
  └─ manuals / attachments   (via attachment injection widget on catalog product page)
        ↑
        │ catalogProductId (UUID FK, id only)
        │
ResourcesResourceType  (classifier / machine type catalogue entry in resources module)
  └─ name, description, appearance (existing)
  └─ catalogProductId  uuid nullable   ← NEW: link to CatalogProduct

ResourcesResource  (specific installed unit / Asset)
  └─ resourceTypeId  →  ResourcesResourceType  →  CatalogProduct
  └─ identity: serialNumber, productionDate, commissioningDate
  └─ ownership: customerId (FK id only), installationAddress (jsonb)
  └─ warranty: warrantyStatus, warrantyExpiresAt
  └─ inspection: inspectionIntervalDays, lastInspectedAt, nextInspectionAt
  └─ components  (ResourcesResourceComponent[], each linked to a CatalogProduct/Variant)
  └─ documents   (via attachment injection widget)
  └─ service photos (attachmentIds on ResourcesResourceActivity)
```

### Component inheritance flow

When a resource is created with a type that has a linked `CatalogProduct`, the system reads the product's `CatalogProductVariantRelation` rows (where `relationType = 'component'`) and creates a `ResourcesResourceComponent` row for each one, storing `catalogProductId` and `catalogVariantId` from the relation. These unit-level rows can then be updated independently (replaced part, different quantity, notes) without touching the type template.

### Module decoupling

- `customerId` stored as UUID only — no ORM cross-module relation
- `catalogProductId` on `ResourcesResourceType` stored as UUID only — no ORM cross-module relation
- `catalogProductId` / `catalogVariantId` on `ResourcesResourceComponent` stored as UUID only — no ORM cross-module relation
- Customer name resolved in a response enricher (`data/enrichers.ts`) for list views
- Catalog product title/spec resolved in a response enricher on the resource-types API for display
- Attachments wired via widget injection — resources module has no direct dependency on attachment internals

---

## Data Models

### Phase 1 — Extended ResourcesResourceType + ResourcesResource fields

```
-- Additions to ResourcesResourceType entity (resources_resource_types table)
catalog_product_id   uuid   nullable   -- FK id only, no ORM relation; points to CatalogProduct

-- Additions to ResourcesResource entity (resources_resources table)
serial_number          text        nullable
customer_id            uuid        nullable   -- FK id only, no ORM relation
installation_address   jsonb       nullable   -- { line1, line2, city, region, postalCode, country }
production_date        timestamptz nullable
commissioning_date     timestamptz nullable
warranty_status        text        nullable   -- 'active' | 'expired' | 'claim'
warranty_expires_at    timestamptz nullable
```

`ResourcesResourceType.catalogProductId` is the bridge to the catalog. When set, the machine type's title, description, and component structure are authoritative on the `CatalogProduct`. The type's own `name` / `description` fields remain as a local override / display shorthand.

### Phase 2 — Asset-level components

One new entity only. No type-level component entity — the component template comes from `CatalogProductVariantRelation` rows on the linked `CatalogProduct`.

```
-- New table: resources_resource_components
id                      uuid PK
tenant_id               uuid
organization_id         uuid
resource_id             uuid        -- FK id only (ResourcesResource)
catalog_product_id      uuid        nullable  -- FK id only; the component product
catalog_variant_id      uuid        nullable  -- FK id only; specific variant if applicable
-- Snapshot fields: copied from catalog at inheritance time, editable per unit
name                    text        -- copied from CatalogProduct.title or overridden
part_number             text        nullable  -- copied from CatalogProduct.sku or overridden
quantity                int         nullable
unit                    text        nullable
-- Unit-specific operational fields
replaced_at             timestamptz nullable
notes                   text        nullable
sort_order              int         default 0
created_at              timestamptz
updated_at              timestamptz
deleted_at              timestamptz nullable
```

Snapshot fields (`name`, `part_number`) are copied from the catalog product at inheritance time so the asset record remains self-contained even if the product is later renamed or deleted.

### Phase 3 — Inspection scheduling fields

```
-- Additions to ResourcesResource entity
inspection_interval_days   int         nullable  -- days between inspections
last_inspected_at          timestamptz nullable  -- set when an inspection activity is logged
next_inspection_at         timestamptz nullable  -- stored: last_inspected_at + interval (denormalized)
```

### Phase 4 — Activity photos

```
-- Addition to ResourcesResourceActivity entity
attachment_ids   jsonb nullable   -- string[] of attachment IDs linked to this activity
```

---

## API Contracts

### Phase 1 — Extended resource-type and resource fields

**GET/POST/PUT `/api/resources/resource-types`** — new field:
- `catalogProductId` (uuid, optional) — link to `CatalogProduct`
- Response enricher adds `_catalog.productTitle`, `_catalog.productDescription` when `catalogProductId` is set

**GET `/api/resources/resources`** — new query params:
- `customerId` (uuid) — filter by customer
- `warrantyStatus` (string) — `'active' | 'expired' | 'claim'`
- `serialNumber` (string) — partial match

New fields in list/detail response per item:
```
serial_number, customer_id, installation_address, production_date,
commissioning_date, warranty_status, warranty_expires_at
```

**POST/PUT `/api/resources/resources`** — new accepted fields:
```
serialNumber, customerId, installationAddress, productionDate,
commissioningDate, warrantyStatus, warrantyExpiresAt
```

### Phase 2 — Component routes

```
GET/POST/PUT/DELETE  /api/resources/resource-components
  query: resourceId (required for GET list)
```

`POST /api/resources/resource-components/inherit` — reads `CatalogProductVariantRelation` rows
for the resource's linked product and creates component rows on the resource:
```json
{ "resourceId": "uuid" }
```
Returns `{ inherited: number }`. Idempotent — skips components already present for the same `catalogProductId` + `catalogVariantId` combination.

### Phase 3 — Inspection fields

Extended on `/api/resources/resources`:
- `inspectionIntervalDays` (int, writable)
- `lastInspectedAt` (timestamptz, writable)
- `nextInspectionAt` (timestamptz, read-only — recomputed by subscriber)

New query param: `inspectionDueBefore` (ISO date string) — filter resources with `nextInspectionAt ≤ date`.

New action route:
```
POST /api/resources/resources/mark-inspected
  { "resourceId": "uuid", "inspectedAt": "ISO date" }
  → { ok: true }  (updates lastInspectedAt, recomputes nextInspectionAt)
```

### Phase 5 — Import

```
POST /api/resources/import
  Content-Type: multipart/form-data
  file: CSV or XLSX
  → { imported: number, skipped: number, errors: [{ row: number, message: string }] }
```

Expected CSV columns (all optional except `name`):
`name`, `serialNumber`, `resourceTypeId`, `customerId`, `commissioningDate`, `warrantyStatus`, `description`, `isActive`

---

## ACL Extensions

Add to `acl.ts` and `setup.ts → defaultRoleFeatures`:

```typescript
'resources.manage_inspections'   // manage inspection schedule, mark as inspected
'resources.manage_components'    // manage components on resource types and assets
'resources.import'               // bulk CSV/Excel import
```

Default grants:
```
admin:      resources.*
employee:   resources.view
```

---

## Events

Add to `events.ts`:

```
resources.resource.inspection_due     -- fires N days before nextInspectionAt (from worker)
resources.resource.inspected          -- fires when lastInspectedAt is set
resources.resource_component.created
resources.resource_component.updated
resources.resource_component.deleted
```

---

## Notifications

New notification type: `resources.inspection_due`
- Triggered by `resources.resource.inspection_due` event
- Renderer: resource name, next inspection date, link to resource detail
- Declared in `notifications.ts` + `notifications.client.ts`

---

## Implementation Phases

### Phase 1 — Machine identity fields + catalog product link (highest priority)

Resource type:
1. Add `catalogProductId` uuid nullable to `ResourcesResourceType` entity
2. Extend `resourcesResourceTypeCreateSchema` / `resourcesResourceTypeUpdateSchema`
3. Update `api/resource-types.ts` list fields; add response enricher (`data/enrichers.ts`) that resolves `_catalog.productTitle` and `_catalog.productDescription` by fetching `/api/catalog/products?ids=...`
4. Update `ResourceTypeCrudForm.tsx` — add product selector field (search `/api/catalog/products`)
5. In resource detail: display inherited product title + description as read-only "Machine type spec" expandable section

Resource:
1. Add 7 new fields to `ResourcesResource` entity
2. `yarn db:generate` → migration covering both entities
3. Extend `resourcesResourceCreateSchema` / `resourcesResourceUpdateSchema`
4. Update CRUD list fields + `buildFilters` in `api/resources.ts`
5. Update `ResourceCrudForm.tsx` — add field groups: Identification, Customer & Location, Warranty
6. Update resource detail page — serial number in header, warranty badge, customer name link
7. Add `customerId`, `warrantyStatus`, `serialNumber` filters to list page
8. i18n keys for all new fields in all locale files

### Phase 2 — Asset-level components (catalog-backed)
1. Add `ResourcesResourceComponent` entity (single new entity)
2. `yarn db:generate` → migration
3. New validators in `data/validators.ts`
4. New commands: create, update, delete, inherit (`commands/resource-components.ts`)
   - `inherit` command: reads `CatalogProductVariantRelation` rows for the resource's linked catalog product, creates one `ResourcesResourceComponent` per relation (skips if already present)
5. New API route `api/resource-components.ts` → `/api/resources/resource-components` (CRUD + inherit action)
6. Wire into `commands/index.ts` and `events.ts`
7. UI: "Components" tab in resource detail — table with name, part number, quantity, replaced date, notes; inline add/edit
8. "Inherit from product" button on Components tab (calls inherit route, refreshes list)
9. Integration tests: component CRUD; inherit from product; idempotent re-inherit
10. i18n

### Phase 3 — Inspection scheduling
1. Add `inspectionIntervalDays`, `lastInspectedAt`, `nextInspectionAt` to `ResourcesResource`
2. Migration
3. Extend validators + API; add `inspectionDueBefore` filter; add `mark-inspected` action route
4. Subscriber `subscribers/resource-inspection-recompute.ts` (persistent) — recomputes `nextInspectionAt` on `resources.resource.updated` when relevant fields change
5. Daily worker `workers/inspection-alerts.ts` — scan resources with `nextInspectionAt ≤ now + N days`, emit `resources.resource.inspection_due`
6. New events in `events.ts`: `resources.resource.inspection_due`, `resources.resource.inspected`
7. Notification type `resources.inspection_due` in `notifications.ts` + `notifications.client.ts` + renderer component
8. Subscriber `subscribers/inspection-due-notify.ts`
9. UI: "Inspection" section in resource detail — interval picker, next date display, "Mark as inspected" button
10. i18n

### Phase 4 — Documentation & photos
1. Add `attachmentIds` jsonb nullable to `ResourcesResourceActivity`
2. Migration
3. Add attachment injection widget for resource detail page (`crud-form:resources:resources_resource`)
4. Add attachment injection widget for resource type detail page (`crud-form:resources:resources_resource_type`)
5. In resource detail: "Documents" section — inherited type-level attachments (read-only, pulled via `catalogProductId` if set) + unit-specific attachments (editable)
6. Photo picker on activity log form — multi-attachment selector stored as `attachmentIds` on the activity row
7. i18n

### Phase 5 — CSV/Excel import
1. Command `resources.resources.import` in `commands/resources.ts` — batch parse, validate, create resources (batches of 100)
2. API route `api/post/resources/import.ts` → `POST /api/resources/import`
3. Backend page `backend/resources/resources/import/page.tsx` — file upload, column mapping UI, validation preview, execute
4. "Import" action button in resource list page header
5. Integration test: import valid CSV; partial error rows; duplicate serial number rejection
6. i18n

---

## Risks & Impact Review

| Risk | Severity | Area | Mitigation | Residual |
|---|---|---|---|---|
| `serialNumber` not globally unique — two resources at different orgs can share serial | Low | Data integrity | Unique DB index scoped to `(tenant_id, organization_id, serial_number)` | Low |
| `customerId` drift — customer deleted, resource still references stale ID | Medium | Data integrity | Enricher returns null gracefully; UI shows "Unknown customer" badge | Low |
| `catalogProductId` drift — product deleted, resource type still references it | Medium | Data integrity | Enricher returns null gracefully; resource type remains usable without the catalog link | Low |
| Component snapshot divergence — catalog product renamed after inheritance, snapshot is stale | Low | Data quality | Snapshot is intentional; "Re-inherit" button available; staleness is by design for asset traceability | Low |
| `installationAddress` JSONB — no structured validation at DB level | Low | Data quality | Validated in zod schema on write | Low |
| `nextInspectionAt` stale if subscriber fails | Medium | Correctness | Worker recomputes on daily scan; subscriber is persistent (retried on failure) | Low |
| Import large files — memory pressure on server | Medium | Reliability | Enforce 5 MB file size limit; process rows in batches of 100; return partial results on error | Low |
| Attachment injection — attachments module API may change | Low | Coupling | Widget injection pattern; no direct import of attachment internals | Low |

---

## Backward Compatibility

- All new DB columns are `nullable` — no existing rows are broken, no migration downtime risk
- `catalogProductId` on `ResourcesResourceType` is optional — existing types without it behave identically
- New API query params are all optional — existing integrations unaffected
- All new fields on create/update schemas use `.optional()` — existing API callers unaffected
- New routes (`/resource-components`, `/import`) are purely additive
- `/resource-type-components` route is **removed** vs. the original plan — there is no type-level component entity; this simplifies the surface
- Events are additive — existing subscribers unaffected

---

## Integration Test Coverage

Per-phase test files under `packages/core/src/modules/resources/__integration__/`:

| Phase | Test file | Key paths |
|---|---|---|
| 1 | `TC-RESO-002.spec.ts` | Create/update resource type with catalogProductId; create/update resource with machine fields; filter by customerId / warrantyStatus / serialNumber |
| 2 | `TC-RESO-003.spec.ts` | Component CRUD; inherit from catalog product's variant relations; idempotent re-inherit |
| 3 | `TC-RESO-004.spec.ts` | Set inspection interval; mark-inspected recomputes nextInspectionAt; worker emits inspection_due |
| 5 | `TC-RESO-005.spec.ts` | Import valid CSV; partial error rows; duplicate serial number rejection |

---

## Final Compliance Report

- [x] No direct ORM relations between modules — `customerId`, `catalogProductId`, `catalogVariantId` stored as UUID only
- [x] All inputs validated with zod; types derived via `z.infer`
- [x] All new routes export `openApi`
- [x] New write routes use Command pattern
- [x] `withAtomicFlush` required in commands that mix mutations and queries on the same EM
- [x] All new columns nullable — no breaking schema changes
- [x] New features declared in `acl.ts` + `setup.ts defaultRoleFeatures`
- [x] New events declared with `as const` in `events.ts`
- [x] i18n via locale files — no hardcoded user-facing strings
- [x] All filters respect tenant/org scope
- [x] Import route enforces `resources.import` feature gate
- [x] `ResourcesResourceTypeComponent` removed — no duplicate component model alongside catalog

---

## Changelog

| Date | Author | Summary |
|---|---|---|
| 2026-04-10 | lkurasin | Initial spec — gap analysis against Customer Machines requirements, six-phase plan |
| 2026-04-10 | lkurasin | Architecture revision — ResourcesResourceType linked to CatalogProduct (UUID only); ResourcesResourceTypeComponent dropped; ResourcesResourceComponent references catalog product/variant; Phase 6 (standalone technicalSpec) replaced by catalog product link in Phase 1; five phases total |