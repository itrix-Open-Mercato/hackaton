## 1. Database Migration — Schema Changes

- [ ] 1.1 Create migration `src/modules/technicians/migrations/Migration20260411180000_merge_field_technicians.ts` adding new columns to the `technicians` table: `first_name` (text null), `last_name` (text null), `email` (text null), `phone` (text null), `location_status` (text not null default 'in_office'), `vehicle_id` (uuid null), `vehicle_label` (text null), `current_order_id` (uuid null), `languages` (jsonb not null default '[]'), `skills` (jsonb not null default '[]'). Use `ADD COLUMN IF NOT EXISTS` for all columns. Drop the `tech_staff_member_unique` constraint and make `staff_member_id` nullable with `ALTER COLUMN staff_member_id DROP NOT NULL`. Populate the `skills` JSONB column from existing `technician_skills` rows using `UPDATE technicians SET skills = (SELECT coalesce(jsonb_agg(lower(ts.name)), '[]'::jsonb) FROM technician_skills ts WHERE ts.technician_id = technicians.id)`.
- [ ] 1.2 In the same migration, add new columns to `technician_certifications`: `cert_type` (text null), `code` (text null), `issued_by` (text null), `notes` (text null), `deleted_at` (timestamptz null). Use `ADD COLUMN IF NOT EXISTS` for all. Write the `down()` method using `DROP COLUMN IF EXISTS` and re-adding the unique constraint.
- [ ] 1.3 Create migration `src/modules/technicians/migrations/Migration20260411180001_technicians_acl_backfill.ts` following the pattern from `src/modules/machine_catalog/migrations/Migration20260411121501_role_acls.ts`. Update `role_acls.features_json` for admin role to include `technicians.view`, `technicians.create`, `technicians.edit`, `technicians.delete` if missing, and for employee role to include `technicians.view`, `technicians.create`, `technicians.edit` if missing. Include idempotent guards and a reversible `down()`.

## 2. Entity Changes

- [ ] 2.1 Update `src/modules/technicians/data/entities.ts` — add new properties to the `Technician` class: `firstName` (text, nullable, name: 'first_name'), `lastName` (text, nullable, name: 'last_name'), `email` (text, nullable), `phone` (text, nullable), `locationStatus` (text, default 'in_office', name: 'location_status'), `vehicleId` (uuid, nullable, name: 'vehicle_id'), `vehicleLabel` (text, nullable, name: 'vehicle_label'), `currentOrderId` (uuid, nullable, name: 'current_order_id'), `languages` (jsonb, default [], type: 'jsonb'), `skills` (jsonb, default [], type: 'jsonb'). Export the `TechnicianLocationStatus` type as `'in_office' | 'on_trip' | 'at_client' | 'unavailable'`. Make `staffMemberId` nullable (`staffMemberId?: string | null`) and add `nullable: true` to its `@Property` decorator. Remove the `@Unique` decorator for `tech_staff_member_unique`. Update `[OptionalProps]` to include new optional fields.
- [ ] 2.2 Update `src/modules/technicians/data/entities.ts` — add new properties to the `TechnicianCertification` class: `certType` (text, nullable, name: 'cert_type'), `code` (text, nullable), `issuedBy` (text, nullable, name: 'issued_by'), `notes` (text, nullable), `deletedAt` (Date, nullable, name: 'deleted_at'). Update `[OptionalProps]` to include the new optional fields.

## 3. Validator Changes

- [ ] 3.1 Update `src/modules/technicians/data/validators.ts` — add `locationStatusSchema = z.enum(['in_office', 'on_trip', 'at_client', 'unavailable'])`. Update `technicianCreateSchema`: make `staff_member_id` optional/nullable (`z.string().uuid().nullable().optional()`), add fields: `first_name` (optionalStr), `last_name` (optionalStr), `email` (`z.string().email().nullable().optional()`), `phone` (optionalStr), `location_status` (`locationStatusSchema.optional().default('in_office')`), `vehicle_id` (uuid nullable optional), `vehicle_label` (optionalStr), `current_order_id` (uuid nullable optional), `languages` (`z.array(z.string()).optional().default([])`).
- [ ] 3.2 Update `technicianUpdateSchema` in the same file: add all the same fields as create (except `staff_member_id`) as optional. Add `first_name`, `last_name`, `email`, `phone`, `location_status`, `vehicle_id`, `vehicle_label`, `current_order_id`, `languages` — all optional.
- [ ] 3.3 Update certification schemas: add to `certificationAddSchema`: `cert_type` (optionalStr), `code` (optionalStr), `issued_by` (optionalStr), `notes` (optionalStr). Add the same fields to `certificationUpdateSchema` as optional/nullable.

## 4. Command Handler Changes

- [ ] 4.1 Update `src/modules/technicians/commands/technicians.ts` — in the create command's `execute`: assign new fields from parsed input to the entity (`firstName`, `lastName`, `email`, `phone`, `locationStatus`, `vehicleId`, `vehicleLabel`, `currentOrderId`, `languages`). Make `staffMemberId` optional — remove the hard 409 reject for duplicate staff members (log a warning instead or skip the check). After creating skills via `TechnicianSkill` records, also set the `skills` JSONB array on the technician entity with lowercased values and flush.
- [ ] 4.2 Update the update command in the same file: handle new fields in `execute` — for each field, apply `if (parsed.field !== undefined) technician.field = parsed.field` pattern. For `languages`, replace the array. For `location_status`, validate it's a valid enum value (already validated by Zod).
- [ ] 4.3 Update `src/modules/technicians/commands/skills.ts` — in the `addSkill` command's `execute`, after creating the `TechnicianSkill` record and flushing, reload the technician's skills and update the `skills` JSONB array: `technician.skills = (await em.find(TechnicianSkill, { technician: technician.id })).map(s => s.name.toLowerCase())`. Flush again. Do the same in `removeSkill` after deleting the skill record.
- [ ] 4.4 Update `src/modules/technicians/commands/certifications.ts` — in the add certification command: assign `certType`, `code`, `issuedBy`, `notes` from parsed input. In the update command: handle these fields with the `if (parsed.field !== undefined)` pattern. In the remove command: set `deletedAt = new Date()` instead of hard-deleting (soft delete).

## 5. API Route Changes

- [ ] 5.1 Update `src/modules/technicians/api/technicians/route.ts` — add new fields to `listFields` array: `first_name`, `last_name`, `email`, `phone`, `location_status`, `vehicle_id`, `vehicle_label`, `current_order_id`, `languages`, `skills`. Add these to the `sortFieldMap` where appropriate (at least `location_status`, `first_name`, `last_name`, `email`).
- [ ] 5.2 In the same file, update `buildFilters`: add `locationStatus` filter (`if (q.locationStatus) F.location_status = q.locationStatus`). The existing `skill` ilike filter via subquery stays as-is.
- [ ] 5.3 Update `transformItem` in the same file to include new fields in the response: `first_name`, `last_name`, `email`, `phone`, `location_status`, `vehicle_id`, `vehicle_label`, `current_order_id`, `languages`, `skills` (the JSONB column). Ensure the `listSchema` z.object includes the new query params (`locationStatus` as optional string).
- [ ] 5.4 Update `src/modules/technicians/types.ts` — add new fields to `TechnicianListItem`: `firstName`, `lastName`, `email`, `phone`, `locationStatus`, `vehicleId`, `vehicleLabel`, `currentOrderId`, `languages`, `skills`. Add new fields to `TechnicianCertificationItem`: `certType`, `code`, `issuedBy`, `notes`.

## 6. Backend UI — List Page

- [ ] 6.1 Update `src/modules/technicians/components/TechniciansTable.tsx` — add a `LocationBadge` component with colored badges: green `bg-green-100 text-green-800` for `in_office`, blue `bg-blue-100 text-blue-800` for `on_trip`, amber `bg-yellow-100 text-yellow-800` for `at_client`, gray `bg-gray-100 text-gray-600` for `unavailable`. Add a `location_status` column to the columns definition using this badge. Add a `first_name` and `last_name` column. Add a `locationStatus` filter (select type) to the filters array with the four status options.

## 7. Backend UI — Create Page

- [ ] 7.1 Update `src/modules/technicians/backend/technicians/create/page.tsx` — make StaffMemberSelect optional (remove required validation). Add form fields: `firstName` (text), `lastName` (text), `email` (text), `phone` (text), `locationStatus` (select with four options), `languages` (tags input). Organize in form groups: Identity (firstName, lastName), Contact (email, phone), Staff Link (staffMemberId — optional), Status (locationStatus, isActive), Competencies (skills, languages), Notes (notes).

## 8. Backend UI — Edit Page

- [ ] 8.1 Update `src/modules/technicians/backend/technicians/[id]/edit/page.tsx` — add the same new form fields as create (firstName, lastName, email, phone, locationStatus, languages). Pre-populate them from the loaded technician data. Organize in the same form groups. Staff member select should remain disabled and optional.
- [ ] 8.2 In the same file, update the CertificationsSection component: add `certType` select (sep, driving_license, other), `code` text input, `issuedBy` text input, and `notes` textarea to the certification add form. Update the certification card display to show certType badge, code, issuedBy, and notes. Add visual expiry indicators: red border + "Expired" badge for expired certs, amber border + "Expiring soon" badge for certs expiring within 30 days.

## 9. Remove field_technicians Module

- [ ] 9.1 Remove `{ id: 'field_technicians', from: '@app' }` from `src/modules.ts`.
- [ ] 9.2 Delete the entire `src/modules/field_technicians/` directory.

## 10. Regenerate and Verify

- [ ] 10.1 Run `yarn generate` to regenerate `.mercato/generated/` with the updated module list and entity changes.
- [ ] 10.2 Run `yarn mercato db migrate` to apply the new migration (confirm with user first).
- [ ] 10.3 Run `yarn test -- --testPathPattern=technicians` to verify existing technician tests still pass.
- [ ] 10.4 Start dev server with `yarn dev` and manually verify: technician list shows new columns (location status, first name, last name), create form has new fields, edit page shows new fields, certification form has new metadata fields, sidebar shows single "Technicians" entry under "Service" group.
