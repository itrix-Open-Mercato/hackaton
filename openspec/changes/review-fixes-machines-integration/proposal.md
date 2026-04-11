## Why

The `codex/machines-service-ticket-integration` branch introduces `machine_catalog` + `machine_instances` modules and integrates them into `service_tickets` via a cascade select. A code review surfaced 2 critical security/functionality bugs blocking merge, 4 important issues (including pre-existing P1/P2 bugs in `service_tickets`), and 6 suggestions. These must be resolved before the branch can ship — the tenant scoping gap is a security vulnerability and the broken machine lookup makes the primary integration unusable.

## What Changes

**Critical fixes:**
- Add `tenantId`/`organizationId` scope filtering to all machine_catalog and machine_instances command handlers (create, update, delete) — currently any authenticated user can mutate cross-tenant records
- Fix `fetchMachineById` to use `ids` (plural) query parameter matching the route's `buildFilters`, or add `id` support to the route — cascade select is broken without this

**Pre-existing service_tickets bug fixes:**
- Add `.refine()` to reject duplicate `staff_member_ids` in validators (P1 #3 — causes partial writes + 500)
- Add ISO datetime validation for `visit_date`/`visit_end_date` (P2 #5)
- Fix UTC→local timezone conversion for `datetime-local` inputs (P1 #2)
- Align OpenAPI schema with actual API response casing (P2 #4)

**Convention compliance:**
- Replace inline SVG sidebar icons with `lucide-react` imports in both machine modules
- Add `IF NOT EXISTS` / `IF EXISTS` guards to machine module migrations
- Add `{ virtual: true }` to MachineCascadeSelect test mocks

**Testing strategy:**
- Write regression tests BEFORE fixes for all 6 behavior bugs (tenant scoping, query param, duplicate staff, date validation, UTC handling, OpenAPI casing) — tests document the bug, then the fix makes them pass

## Capabilities

### New Capabilities
- `regression-tests`: Regression test suite covering the 6 behavior bugs — written before fixes to lock in expected behavior
- `tenant-scoping-fix`: Tenant isolation enforcement in machine_catalog and machine_instances commands
- `machine-lookup-fix`: Correct single-machine fetch for cascade select hydration

### Modified Capabilities
_(No existing specs to modify)_

## Impact

- **Security:** Closes cross-tenant data access vulnerability in machine commands
- **Modules affected:** `machine_catalog`, `machine_instances`, `service_tickets`
- **API:** Query parameter contract change for machine_instances list endpoint (adds `id` support or client changes to `ids`)
- **Validators:** Stricter input validation — previously-accepted invalid inputs will now be rejected (duplicate staff IDs, non-ISO dates)
- **Migrations:** Existing migration files modified to add idempotency guards
- **Tests:** ~12-15 new test cases across 3 modules
