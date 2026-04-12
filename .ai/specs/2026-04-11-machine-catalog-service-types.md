# machine_catalog — Per-Service-Type Configuration

**Date**: 2026-04-11
**Status**: Draft

## TLDR

Replace the flat `supportedServiceTypes` JSONB field (and related flat defaults) on `MachineCatalogProfile` with a first-class `MachineCatalogServiceType` entity — one row per service entry, many per profile. All service-level defaults (`defaultTeamSize`, `defaultServiceDurationMinutes`, `startupNotes`, `serviceNotes`) and requirements (`requiredSkills`, `requiredCertifications`) move here as proper sub-relations. Each service type also carries a list of `MachineCatalogServiceTypePart` rows (catalog product + quantity), replacing the old `MachineCatalogPartTemplate` entity. Management UI is an inline section on the existing profile edit page.

## Problem Statement

The current design stores service configuration as flat JSONB arrays and scalar defaults at the profile level. This prevents configuring different team sizes, durations, notes, skill requirements, or part kits per service type — all instances of a machine share one flat set of defaults regardless of what kind of service is being performed.

## Proposed Solution

Introduce `MachineCatalogServiceType` as a proper child entity of `MachineCatalogProfile`. Each profile can have N service types (free-text label, e.g. `"regular"`, `"commissioning"`, `"warranty"`). Each service type carries its own:
- Team size and duration defaults
- Startup and service notes
- Required skills (junction rows, autosuggest from `technician_skills.name`)
- Required certifications (junction rows, autosuggest from `technician_certifications.name`)
- Service parts (junction rows: catalog product + quantity)

The existing `MachineCatalogPartTemplate` entity is dropped entirely (no data migration needed — clean slate). Seven columns are removed from `machine_catalog_profiles`.

## Data Models

### Entities to remove

| Entity | Table | Action |
|--------|-------|--------|
| `MachineCatalogPartTemplate` | `machine_catalog_part_templates` | Drop table |

### Columns removed from `MachineCatalogProfile`

| Column | Type | Note |
|--------|------|------|
| `supported_service_types` | `jsonb` | Replaced by child entity |
| `required_skills` | `jsonb` | Moved to `MachineCatalogServiceTypeSkill` |
| `required_certifications` | `jsonb` | Moved to `MachineCatalogServiceTypeCertification` |
| `default_team_size` | `int` | Moved to `MachineCatalogServiceType` |
| `default_service_duration_minutes` | `int` | Moved to `MachineCatalogServiceType` |
| `startup_notes` | `text` | Moved to `MachineCatalogServiceType` |
| `service_notes` | `text` | Moved to `MachineCatalogServiceType` |

### New entities

#### `MachineCatalogServiceType`
Table: `machine_catalog_service_types`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | Required, indexed |
| `organization_id` | `uuid` | Required, indexed |
| `machine_profile_id` | `uuid` | FK → `machine_catalog_profiles.id`, FK ID only |
| `service_type` | `text` | Free-text label, e.g. `"regular"`, `"commissioning"` |
| `default_team_size` | `int` nullable | |
| `default_service_duration_minutes` | `int` nullable | |
| `startup_notes` | `text` nullable | |
| `service_notes` | `text` nullable | |
| `sort_order` | `int` default 0 | Display ordering |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |
| `deleted_at` | `timestamp` nullable | Soft delete |

Indexes: `(tenant_id, organization_id)`, `(machine_profile_id)`

---

#### `MachineCatalogServiceTypeSkill`
Table: `machine_catalog_service_type_skills`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid` | |
| `organization_id` | `uuid` | |
| `machine_service_type_id` | `uuid` | FK → `machine_catalog_service_types.id`, FK ID only |
| `skill_name` | `text` | Denormalized from `technician_skills.name` (soft reference) |
| `created_at` | `timestamp` | |

Indexes: `(machine_service_type_id)`
Unique constraint: `(machine_service_type_id, skill_name)`

---

#### `MachineCatalogServiceTypeCertification`
Table: `machine_catalog_service_type_certifications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid` | |
| `organization_id` | `uuid` | |
| `machine_service_type_id` | `uuid` | FK → `machine_catalog_service_types.id`, FK ID only |
| `certification_name` | `text` | Denormalized from `technician_certifications.name` (soft reference) |
| `created_at` | `timestamp` | |

Indexes: `(machine_service_type_id)`
Unique constraint: `(machine_service_type_id, certification_name)`

---

#### `MachineCatalogServiceTypePart`
Table: `machine_catalog_service_type_parts`

Replaces `MachineCatalogPartTemplate`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid` | |
| `organization_id` | `uuid` | |
| `machine_service_type_id` | `uuid` | FK → `machine_catalog_service_types.id`, FK ID only |
| `catalog_product_id` | `uuid` | FK → catalog product, FK ID only |
| `quantity` | `decimal(10,3)` | Required, > 0 |
| `sort_order` | `int` default 0 | |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

Indexes: `(machine_service_type_id)`, `(catalog_product_id)`

## API Contracts

### Service Types

```
GET    /api/machine_catalog/service-types
       ?machineProfileId=<uuid>&page&pageSize
       → list of service type rows (flat, snake_case)

POST   /api/machine_catalog/service-types
       body: { machineProfileId, serviceType, defaultTeamSize?, defaultServiceDurationMinutes?,
               startupNotes?, serviceNotes?, sortOrder? }
       → { id }

PUT    /api/machine_catalog/service-types
       body: { id, serviceType?, defaultTeamSize?, defaultServiceDurationMinutes?,
               startupNotes?, serviceNotes?, sortOrder? }
       → { ok: true }

DELETE /api/machine_catalog/service-types
       body: { id }
       → { ok: true }
       Side effect: cascade-delete associated skills, certifications, parts
```

### Service Type Skills

```
GET    /api/machine_catalog/service-type-skills
       ?machineServiceTypeId=<uuid>
       → list of skill rows

POST   /api/machine_catalog/service-type-skills
       body: { machineServiceTypeId, skillName }
       → { id }

DELETE /api/machine_catalog/service-type-skills
       body: { id }
       → { ok: true }

GET    /api/machine_catalog/service-type-skills/suggest
       ?q=<string>
       → { items: string[] }
       Queries DISTINCT name FROM technician_skills WHERE org matches and name ILIKE %q%
```

### Service Type Certifications

```
GET    /api/machine_catalog/service-type-certifications
       ?machineServiceTypeId=<uuid>
       → list of certification rows

POST   /api/machine_catalog/service-type-certifications
       body: { machineServiceTypeId, certificationName }
       → { id }

DELETE /api/machine_catalog/service-type-certifications
       body: { id }
       → { ok: true }

GET    /api/machine_catalog/service-type-certifications/suggest
       ?q=<string>
       → { items: string[] }
       Queries DISTINCT name FROM technician_certifications WHERE org matches and name ILIKE %q%
```

### Service Type Parts

```
GET    /api/machine_catalog/service-type-parts
       ?machineServiceTypeId=<uuid>
       → list of part rows (includes catalog_product_id, quantity)

POST   /api/machine_catalog/service-type-parts
       body: { machineServiceTypeId, catalogProductId, quantity, sortOrder? }
       → { id }

PUT    /api/machine_catalog/service-type-parts
       body: { id, quantity?, sortOrder? }
       → { ok: true }

DELETE /api/machine_catalog/service-type-parts
       body: { id }
       → { ok: true }
```

All routes require `machine_catalog.view` (GET) / `machine_catalog.manage` (mutations).
All routes export `openApi`.

## Migration Plan

Single migration file: `Migration<timestamp>_machine_catalog_service_types.ts`

```sql
-- 1. Drop old part templates table
DROP TABLE IF EXISTS machine_catalog_part_templates;

-- 2. Drop moved columns from profiles
ALTER TABLE machine_catalog_profiles
  DROP COLUMN IF EXISTS supported_service_types,
  DROP COLUMN IF EXISTS required_skills,
  DROP COLUMN IF EXISTS required_certifications,
  DROP COLUMN IF EXISTS default_team_size,
  DROP COLUMN IF EXISTS default_service_duration_minutes,
  DROP COLUMN IF EXISTS startup_notes,
  DROP COLUMN IF EXISTS service_notes;

-- 3. Create machine_catalog_service_types
CREATE TABLE IF NOT EXISTS machine_catalog_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  machine_profile_id uuid NOT NULL,
  service_type text NOT NULL,
  default_team_size int,
  default_service_duration_minutes int,
  startup_notes text,
  service_notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS mcat_st_tenant_org_idx ON machine_catalog_service_types (tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS mcat_st_profile_idx ON machine_catalog_service_types (machine_profile_id);

-- 4. Create machine_catalog_service_type_skills
CREATE TABLE IF NOT EXISTS machine_catalog_service_type_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  machine_service_type_id uuid NOT NULL,
  skill_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine_service_type_id, skill_name)
);
CREATE INDEX IF NOT EXISTS mcat_sts_service_type_idx ON machine_catalog_service_type_skills (machine_service_type_id);

-- 5. Create machine_catalog_service_type_certifications
CREATE TABLE IF NOT EXISTS machine_catalog_service_type_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  machine_service_type_id uuid NOT NULL,
  certification_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine_service_type_id, certification_name)
);
CREATE INDEX IF NOT EXISTS mcat_stc_service_type_idx ON machine_catalog_service_type_certifications (machine_service_type_id);

-- 6. Create machine_catalog_service_type_parts
CREATE TABLE IF NOT EXISTS machine_catalog_service_type_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  machine_service_type_id uuid NOT NULL,
  catalog_product_id uuid NOT NULL,
  quantity decimal(10,3) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcat_stp_service_type_idx ON machine_catalog_service_type_parts (machine_service_type_id);
```

> **Note**: Write migration manually (Node 24 `db generate` bug). Confirm with user before running `yarn mercato db migrate`.

## UI Design (Inline on Profile Edit Page)

Section added below existing profile fields, titled **"Service Types"**.

### Service Type List (collapsed cards)

Each card shows: service type name badge, team size, duration, skill/cert count, part count. Expand button opens the accordion panel.

### Accordion Panel (per service type)

```
┌─────────────────────────────────────────────────┐
│ Service Type: [_______________] (text input)     │
│                                                  │
│ Team size: [__]   Duration (min): [____]         │
│                                                  │
│ Startup notes: [textarea]                        │
│ Service notes: [textarea]                        │
│                                                  │
│ Required Skills: [autosuggest chip input]        │
│   chips: "Hydraulics" × "Welding" ×              │
│                                                  │
│ Required Certifications: [autosuggest chip input]│
│   chips: "UDT" × "SEP" ×                        │
│                                                  │
│ Service Parts:                                   │
│ ┌──────────────────────┬──────────┬──────┐       │
│ │ Product              │ Quantity │      │       │
│ ├──────────────────────┼──────────┼──────┤       │
│ │ [product picker]     │ [0.000]  │ [×]  │       │
│ └──────────────────────┴──────────┴──────┘       │
│ [+ Add part]                                     │
│                                   [Save] [Del]   │
└─────────────────────────────────────────────────┘
```

- Autosuggest calls `/api/machine_catalog/service-type-skills/suggest?q=...` and `/api/machine_catalog/service-type-certifications/suggest?q=...`
- Skills/certifications submitted as add/remove diff on Save
- Parts: inline add/remove/quantity edit, submitted on Save
- Delete service type: confirm dialog before DELETE call
- "Add service type" button appends a new empty accordion panel (not yet saved)

## Implementation Phases

### Phase 1 — Data layer

- [ ] Write new entities: `MachineCatalogServiceType`, `MachineCatalogServiceTypeSkill`, `MachineCatalogServiceTypeCertification`, `MachineCatalogServiceTypePart`
- [ ] Remove deleted fields from `MachineCatalogProfile` entity
- [ ] Remove `MachineCatalogPartTemplate` entity
- [ ] Write Zod validators for all new entities (create + update schemas)
- [ ] Write commands: service-types CRUD, skills CRUD, certifications CRUD, parts CRUD
- [ ] Write migration file (manually — Node 24 constraint)

### Phase 2 — API layer

- [ ] Route: `/api/machine_catalog/service-types` (GET/POST/PUT/DELETE)
- [ ] Route: `/api/machine_catalog/service-type-skills` (GET/POST/DELETE + `/suggest` GET)
- [ ] Route: `/api/machine_catalog/service-type-certifications` (GET/POST/DELETE + `/suggest` GET)
- [ ] Route: `/api/machine_catalog/service-type-parts` (GET/POST/PUT/DELETE)
- [ ] Remove old `/api/machine_catalog/part-templates` route and route file
- [ ] Update `openApi` exports on all routes
- [ ] Update `commands/machine-catalog.ts` to remove part_template commands

### Phase 3 — UI layer

- [ ] Add "Service Types" inline section to profile edit page (`backend/machine-catalog/[id]/page.tsx` or equivalent)
- [ ] Service type accordion component with form fields
- [ ] Skill/certification autosuggest chip inputs (debounced, calls suggest endpoints)
- [ ] Service parts inline table with product picker and quantity input
- [ ] Add/remove service type logic (optimistic UI or full reload on save)

## Risks & Impact

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking service ticket logic that reads `supportedServiceTypes` off the profile | High | Grep codebase for references to `supportedServiceTypes` / `supported_service_types` before migration |
| `MachineCatalogPartTemplate` removal breaks existing queries | Medium | Remove route file + commands cleanly; old API 404s gracefully |
| Autosuggest cross-module Knex query touching `technician_skills` | Low | Use raw Knex (not ORM import) per Turbopack cross-module rule |
| Node 24 migration gen bug | Medium | Manual SQL migration required — no `yarn mercato db generate` |

## Acceptance Criteria

- [ ] Profile edit page shows a "Service Types" section with existing service types listed
- [ ] User can add a new service type with free-text label
- [ ] Each service type persists team size, duration, startup notes, service notes
- [ ] Skills and certifications autosuggest from existing technician records by name
- [ ] Skills/certifications can be added and removed per service type
- [ ] Service parts can be added, quantity edited, and removed per service type
- [ ] Deleting a service type removes it and all its child rows
- [ ] Profiles no longer expose the seven removed flat fields
- [ ] Old part-templates API route is gone (404)
- [ ] All new routes export `openApi` and enforce ACL features

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial spec — skeleton + open questions |
| 2026-04-11 | Full spec — answers: free-text service type, soft FK skills/certs via junction tables, replace part templates, clean-slate migration, inline UI |
