## Why

Two separate modules (`technicians` and `field_technicians`) both manage technician profiles with overlapping functionality (skills, certifications, staff links). The `field_technicians` module adds dispatch-critical features (location status, vehicle tracking, contact info, languages) that the existing `technicians` module lacks, but it has 6 bugs preventing it from working. Rather than fix the duplicate module, merge the new capabilities into the existing `technicians` module and remove `field_technicians`.

## What Changes

- **Extend `technicians` entity** with fields from `field_technicians`: `firstName`, `lastName`, `email`, `phone`, `locationStatus`, `vehicleId`, `vehicleLabel`, `currentOrderId`, `languages` (JSONB array). Make `staffMemberId` optional (currently required with unique constraint).
- **Extend `technician_certifications` entity** with richer metadata: `certType`, `code`, `issuedBy`, `notes`, `deletedAt` (soft delete).
- **Add `skills` JSONB array** to the technicians table as a denormalized field alongside the existing `technician_skills` relational table (keep both — the relational table supports the existing skills commands, JSONB enables fast list-level filtering).
- **Update API route** to expose new fields, add `locationStatus` filter, and include new fields in `transformItem`.
- **Update validators** with new fields and `locationStatusSchema` enum.
- **Update commands** to handle new fields on create/update.
- **Update backend UI** — list page (add location status column), create page (add new fields), edit page (add new fields), certification form (add new metadata fields).
- **New migration** to `ALTER TABLE` both tables with new columns.
- **ACL backfill migration** for existing tenants (if `technicians.*` features are missing for the `employee` role).
- **Remove `field_technicians`** module from `src/modules.ts` and delete the `src/modules/field_technicians/` directory.
- **Fix sidebar grouping** — ensure `pageGroupKey` uses `service_tickets.nav.group`.

## Capabilities

### New Capabilities

- `technician-dispatch-fields`: Location status, vehicle tracking, contact info, languages, and optional staff link — extending the existing technician entity for dispatch workflows.
- `technician-certification-metadata`: Richer certification records with cert type, code, issuing authority, notes, and soft delete.

### Modified Capabilities

- `technician-profiles`: Make `staffMemberId` optional, add `skills` JSONB array, add `firstName`/`lastName`/`email`/`phone` directly on entity.

## Impact

- **Tables altered:** `technicians` (10 new columns, unique constraint change), `technician_certifications` (5 new columns)
- **Module removed:** `field_technicians` (entire directory + entry in `src/modules.ts`)
- **Files modified:** ~12 files in `src/modules/technicians/` (entities, validators, route, commands, pages, types, setup)
- **Files created:** 1 new migration
- **Operational:** `yarn generate` + `yarn mercato db migrate` required after changes
- **No breaking API changes** — all additions are optional fields; existing API consumers unaffected
- **Widgets unaffected** — TechnicianPicker widget continues to work with extended data
