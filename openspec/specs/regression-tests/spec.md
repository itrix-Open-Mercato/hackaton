# Capability: Regression Tests

## Purpose

Test-first verification for bug fixes across service tickets and machine modules — validators, datetime handling, OpenAPI schema consistency, and filter logic.

## Requirements

### Requirement: Regression tests SHALL be written BEFORE fixes

For each behavior bug, a test SHALL be written that documents the current (broken) behavior. The test SHALL initially assert the buggy behavior (to confirm the bug exists), then be updated to assert the correct behavior after the fix is applied. This ensures each fix is verified by a test.

#### Scenario: Test-first workflow for each bug
- **WHEN** a developer begins fixing a behavior bug
- **THEN** they SHALL first write a test that exercises the buggy code path, confirm it demonstrates the bug, then apply the fix and verify the test now passes with correct behavior

### Requirement: Duplicate staff_member_ids SHALL be rejected by validators

The `ticketCreateSchema` and `ticketUpdateSchema` SHALL reject `staff_member_ids` arrays containing duplicate UUIDs. Validation SHALL fail with a descriptive error message.

#### Scenario: Duplicate staff IDs in create schema
- **WHEN** `ticketCreateSchema.parse()` is called with `staff_member_ids: ["uuid-1", "uuid-1"]`
- **THEN** validation SHALL fail with an error indicating duplicate staff member IDs are not allowed

#### Scenario: Unique staff IDs in create schema
- **WHEN** `ticketCreateSchema.parse()` is called with `staff_member_ids: ["uuid-1", "uuid-2"]`
- **THEN** validation SHALL succeed

#### Scenario: Duplicate staff IDs in update schema
- **WHEN** `ticketUpdateSchema.parse()` is called with `staff_member_ids: ["uuid-1", "uuid-1"]`
- **THEN** validation SHALL fail

### Requirement: visit_date and visit_end_date SHALL accept only ISO 8601 datetime strings

The `ticketCreateSchema` and `ticketUpdateSchema` SHALL validate that `visit_date` and `visit_end_date` conform to ISO 8601 datetime format when provided. Arbitrary strings SHALL be rejected.

#### Scenario: Valid ISO datetime accepted
- **WHEN** `ticketCreateSchema.parse()` is called with `visit_date: "2026-04-15T09:00:00.000Z"`
- **THEN** validation SHALL succeed

#### Scenario: datetime-local format accepted
- **WHEN** `ticketCreateSchema.parse()` is called with `visit_date: "2026-04-15T09:00"`
- **THEN** validation SHALL succeed (HTML datetime-local format is a valid subset)

#### Scenario: Arbitrary string rejected
- **WHEN** `ticketCreateSchema.parse()` is called with `visit_date: "next tuesday"`
- **THEN** validation SHALL fail

#### Scenario: Empty string treated as undefined
- **WHEN** `ticketCreateSchema.parse()` is called with `visit_date: ""`
- **THEN** validation SHALL succeed (empty string maps to undefined via existing `emptyToUndefined` transform)

### Requirement: UTC datetimes SHALL be converted to local time for datetime-local inputs

The `mapTicketToFormValues` function SHALL convert UTC ISO 8601 datetime strings to the user's local timezone before truncating to `YYYY-MM-DDTHH:mm` format for HTML `datetime-local` inputs. Raw `.slice(0, 16)` on a UTC string is NOT acceptable.

#### Scenario: UTC datetime converted for local display
- **WHEN** `mapTicketToFormValues` receives a ticket with `visitDate: "2026-04-11T15:30:00.000Z"`
- **THEN** the returned `visit_date` form value SHALL represent 15:30 UTC expressed in the user's local timezone (e.g., "2026-04-11T17:30" for UTC+2)

#### Scenario: Null datetime produces empty string
- **WHEN** `mapTicketToFormValues` receives a ticket with `visitDate: null`
- **THEN** the returned `visit_date` form value SHALL be `""`

### Requirement: OpenAPI ticketListItemSchema SHALL match actual API response casing

The `ticketListItemSchema` in `openapi.ts` SHALL use field names that match the actual API response format. If the API returns camelCase (from MikroORM), the schema SHALL use camelCase. If the API returns snake_case, the schema SHALL use snake_case. The schema and response MUST agree.

#### Scenario: Schema parses actual API response without error
- **WHEN** `ticketListItemSchema.parse()` is called with a response object from the service_tickets list endpoint
- **THEN** parsing SHALL succeed without error

#### Scenario: Schema field names match response field names
- **WHEN** the API returns a field named `ticketNumber` (camelCase)
- **THEN** the schema SHALL accept `ticketNumber`, not require `ticket_number`

### Requirement: buildFilters SHALL handle singular id parameter

The machine_instances route's `buildFilters` function SHALL recognize a singular `id` query parameter and filter accordingly.

#### Scenario: Singular id in query
- **WHEN** `buildFilters` receives `{ id: "<uuid>" }`
- **THEN** the returned filters SHALL include `{ id: { $in: ["<uuid>"] } }`

#### Scenario: Plural ids still works
- **WHEN** `buildFilters` receives `{ ids: "<uuid1>,<uuid2>" }`
- **THEN** the returned filters SHALL include `{ id: { $in: ["<uuid1>", "<uuid2>"] } }`
