# Code Review: Company Validation & Display for Service Tickets

**Branch**: `feature/service-company`
**Date**: 2026-04-11
**Commits**: `6d69f11` (Add company to grid and person validation), `2e498b0` (Add more spec context)

## Summary

Two commits adding: (1) server-side validation that a contact person belongs to the selected company on ticket create/update, (2) a response enricher that batch-resolves company names for the ticket list, (3) a company column and async company filter in the ticket list table. Overall quality is solid — cross-module boundaries are respected, tenant isolation is maintained, and the enricher avoids N+1. A few medium-severity issues around i18n and the `customer_people` table assumption.

## CI/CD Verification

| Gate | Status | Notes |
|------|--------|-------|
| `yarn generate` | **PASS** | Completed successfully |
| `yarn typecheck` | **FAIL** (pre-existing) | 25 errors — identical count on `main`. 12 in `node_modules/@open-mercato/core/resources/` (framework bug), 13 in test mocks missing `organizationScope`/`organizationIds`. **Zero new errors introduced by this branch.** |
| `yarn test` | **PASS** | 34 tests, 8 suites — all passing |
| `yarn build` | **FAIL** (pre-existing) | Same `resources` module error from `node_modules`. Not introduced by this branch. |

## Findings

### Medium

**M1. Validation error messages are hardcoded English, not i18n keys**
- File: `src/modules/service_tickets/commands/tickets.ts:30,100`
- i18n keys `service_tickets.validation.contactPersonNotInCompany` and `service_tickets.validation.contactPersonRequiresCompany` were added to both `en.json` and `pl.json`, but the command throws hardcoded English strings (`"Contact person does not belong to the selected company"`, `"Contact person requires a company to be selected"`). Polish-language users will see English validation errors.
- **Fix**: Use the i18n keys in the error response, or at minimum use the key identifier so the frontend can map it.

**M2. `customer_people` table name assumption is unverified**
- File: `src/modules/service_tickets/commands/tickets.ts:25`
- The validation queries `customer_people` with columns `company_entity_id` and `entity_id`. This is a raw Knex query against the customers module's internal schema. If the customers module uses a different table name (e.g., `customer_people_entities`, or a junction table), this will silently fail. The enricher's `customer_entities` reference is safer since that table name appears in the spec. Consider verifying `customer_people` exists.

**M3. Test mock `CommandRuntimeContext` is incomplete**
- File: `src/modules/service_tickets/commands/__tests__/tickets.test.ts`
- The `createCtx()` helper doesn't include `organizationScope` and `organizationIds` properties, causing 13 TS errors. Pre-existing issue, but this branch adds more tests using the same pattern (lines 281, 304, 330, 354, 394, 413), deepening the debt.
- **Fix**: Add `organizationScope: 'single'` and `organizationIds: ['org-1']` (or appropriate values) to `createCtx()`.

### Low

**L1. Integration test is a no-op**
- File: `src/modules/service_tickets/__integration__/verify-table.spec.ts:86`
- `expect(true).toBe(true)` — this is a diagnostic tool, not a real test. It will always pass regardless of the page state. Fine for hackathon debugging but should be removed or converted to a real assertion before merge to main.

**L2. `(em as any)` casts**
- Files: `commands/tickets.ts:24`, `data/enrichers.ts:26,55`
- Necessary because the `EntityManager` type doesn't expose `.getConnection().getKnex()`. Matches the existing pattern in `generateTicketNumber`. Acceptable for hackathon pace.

## Checklist

### 1. Architecture & Module Independence
- [x] No ORM relationships between modules — FK IDs only (uses raw Knex for cross-module lookups)
- [x] No direct module-to-module function calls for side effects
- [x] Code in correct location (`src/modules/service_tickets/`)
- [x] No cross-tenant data exposure (enricher filters by `organization_id` + `tenant_id`)

### 2. Security
- [x] Auth guards on endpoints (unchanged, pre-existing)
- [x] Tenant isolation: enricher queries filter by `organization_id` and `tenant_id`
- [ ] `(em as any)` casts bypass type safety (L2 — acceptable)

### 3. Data Integrity & ORM
- [x] No entity/migration changes in this PR — no `db generate` needed
- [x] Validation prevents inconsistent contact-person/company pairs

### 4. API Routes
- [x] No route changes — enricher wired at framework level

### 5. Events & Commands
- [x] Validation added to both create and update command paths
- [x] Update correctly resolves effective company/person for partial updates

### 6. UI & Backend Pages
- [x] Table uses `DataTable` component
- [x] Company column reads from enriched response field
- [x] Company filter uses `combobox` type with async `loadOptions`
- [x] Error handling in filter (`catch` returns `[]`)
- [x] i18n: `useT()` used for column headers and filter labels

### 7. Naming Conventions
- [x] Module ID: `service_tickets` (plural, snake_case)
- [x] JS/TS identifiers: camelCase
- [x] Enricher ID: `service_tickets.company-name`

### 8. Anti-Patterns
- [x] No cross-module ORM links
- [x] No direct `fetch()` calls (uses `readApiResultOrThrow`)
- [x] No empty `catch` blocks (filter catch returns `[]`)
- [ ] `as any` casts (L2 — acceptable for hackathon)

## Test Coverage

- **Validation helper**: 2 direct tests (pass/fail) + 5 integration tests through create/update commands covering all 6 spec scenarios
- **Enricher**: No unit tests — acceptable per design doc ("easier to verify visually")
- **Table column/filter**: Existing table test updated with mock for `customerOptions`
