## Context

Two modules manage technician profiles: `technicians` (existing, integrated with service tickets via widgets) and `field_technicians` (new on branch `features/technicians_availability`, has 6 bugs). They overlap on skills and certifications but `field_technicians` adds dispatch features (location status, vehicle, contact info, languages) and removes the hard staff-member requirement. The user decided to merge rather than maintain duplicates.

The existing `technicians` module is the merge target because it has working widgets (TechnicianPicker injected into service ticket forms), seed data, and established ACL features. The `field_technicians` module provides the feature additions.

### Current State — `technicians` module

**Technician entity:** `id`, `tenantId`, `organizationId`, `staffMemberId` (required, unique per tenant), `isActive`, `notes`, `createdAt`, `updatedAt`, `deletedAt`.

**TechnicianSkill entity:** Separate relational table. `id`, `tenantId`, `organizationId`, `technician` (ManyToOne), `name` (unique per technician), `createdAt`.

**TechnicianCertification entity:** `id`, `tenantId`, `organizationId`, `technician` (ManyToOne), `name`, `certificateNumber`, `issuedAt`, `expiresAt`, `createdAt`, `updatedAt`.

**API route:** Enriches list items with `staffMemberName` (via knex join), `skills` array, `certificationCount`, and `certifications` array (with computed `isExpired`). Filters: `id`, `ids`, `is_active`, `skill` (ilike), `staff_member_id`, `staff_member_ids`.

**Backend UI:** List table shows staffMemberName, isActive badge, skill tags, certification count. Create form has StaffMemberSelect (required), isActive, notes, skills tags input. Edit page has same fields plus inline skills/certifications management.

### Features to Add from `field_technicians`

| Field | Type | Purpose |
|-------|------|---------|
| `firstName` | text, nullable | Direct contact name (independent of staff link) |
| `lastName` | text, nullable | Direct contact name |
| `email` | text, nullable | Direct contact |
| `phone` | text, nullable | Direct contact |
| `locationStatus` | text, default `in_office` | Dispatch: in_office / on_trip / at_client / unavailable |
| `vehicleId` | uuid, nullable | Fleet vehicle FK |
| `vehicleLabel` | text, nullable | Denormalized vehicle name |
| `currentOrderId` | uuid, nullable | Currently assigned work order |
| `languages` | jsonb, default `[]` | Communication languages for international dispatch |
| `skills` (JSONB) | jsonb, default `[]` | Denormalized skill array for fast filtering |

**Certification additions:** `certType` (text), `code` (text), `issuedBy` (text), `notes` (text), `deletedAt` (timestamptz for soft delete).

**staffMemberId** becomes optional — drop the unique constraint.

## Goals / Non-Goals

**Goals:**
- Extend `technicians` entity and certifications with all `field_technicians` fields
- Make `staffMemberId` optional so technicians can exist without a staff link
- Add `locationStatus` filtering to the API and a status column to the list page
- Enrich the create and edit forms with new fields
- Add richer certification metadata (type, code, issuing authority, notes)
- Remove the `field_technicians` module entirely
- Maintain backward compatibility — existing API consumers and widgets keep working

**Non-Goals:**
- Migrating data from `field_technicians` tables (they contain no production data — the module never worked)
- Changing the relational `technician_skills` table to JSONB-only (keep both: relational for existing commands, JSONB for fast list filtering)
- Adding vehicle management or schedule integration (those are separate modules)
- Changing the TechnicianPicker widget (it already works and will gain access to new fields)

## Decisions

### 1. Keep relational skills table AND add JSONB `skills` column

**Decision:** Add a `skills` JSONB array column to the `technicians` table. Keep the existing `technician_skills` relational table and its commands (`addSkill`, `removeSkill`). Sync the JSONB column when skills change.

**Why:** The relational table supports granular add/remove operations and unique constraints. The JSONB column enables fast `?|` array-contains filtering in list queries without joins. Both are useful; the sync cost is minimal (write to JSONB on skill add/remove).

**Alternative considered:** Drop the relational table entirely and switch to JSONB-only like `field_technicians`. Rejected because it would break the existing `addSkill`/`removeSkill` commands and the TechnicianPicker component which uses `skillItems`.

### 2. Make `staffMemberId` optional by dropping the unique constraint

**Decision:** Remove the `UNIQUE(staffMemberId, tenantId, organizationId)` constraint. Make `staffMemberId` nullable in the entity. Keep the `StaffMemberSelect` on the form but make it optional.

**Why:** `field_technicians` allows standalone technician records not linked to staff. This enables external contractors or part-time technicians who don't have HR records. The uniqueness check in the create command can be kept as a soft validation (check-and-warn rather than hard reject).

**Alternative considered:** Keep staffMemberId required and add a separate "external technician" flag. Rejected because it adds complexity for the same result.

### 3. Single migration for all schema changes

**Decision:** Write one migration that adds all new columns to `technicians` and `technician_certifications`, drops the unique constraint on `staffMemberId`, and uses `IF NOT EXISTS` / `IF EXISTS` guards throughout. Use a separate migration for ACL backfill (following the `machine_catalog` pattern).

**Why:** All schema changes are additive (`ADD COLUMN IF NOT EXISTS`) and can be applied atomically. Splitting into multiple migrations adds ordering complexity for no benefit.

### 4. Update existing forms inline rather than rewriting

**Decision:** Extend the existing create/edit pages with new fields in new form groups, keeping existing fields and behavior intact.

**Why:** The existing forms work and are integrated with the TechniciansTable component. Rewriting would risk breaking the widget injection and existing functionality. Adding fields to existing form structures is low-risk.

### 5. Remove `field_technicians` module completely

**Decision:** Delete `src/modules/field_technicians/` directory and remove the entry from `src/modules.ts`. Do NOT drop the `field_technicians` / `field_technician_certifications` DB tables (leave them as orphaned tables in case rollback is needed).

**Why:** The module never worked in production and contains no real data. Leaving orphaned tables is harmless and provides a safety net. The tables can be dropped in a future cleanup migration.

## Risks / Trade-offs

**[Risk] JSONB `skills` column goes out of sync with `technician_skills` table** → Mitigate by updating the JSONB column in the `addSkill` and `removeSkill` command handlers. The migration populates the JSONB column from existing relational data.

**[Risk] Existing TechnicianPicker widget breaks with optional staffMemberId** → Low risk. The widget queries technicians by `is_active` and displays `staffMemberName`. If `staffMemberId` is null, the enrichment returns null for `staffMemberName` — the widget should handle this with a fallback to `firstName + lastName` or `displayName`. Verify in testing.

**[Risk] Large migration on existing data** → Low risk. All columns are nullable additions with defaults. The constraint drop is a metadata-only operation. No data migration needed (new columns default to null/empty).

**[Risk] Form complexity increases** → Mitigate by using form groups to organize fields. Identity/Contact in one group, Status/Dispatch in another, Competencies in a third. Users see a structured form, not a flat wall of fields.
