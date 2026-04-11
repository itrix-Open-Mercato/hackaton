# Code Review: `codex/machines-service-ticket-integration`

**Date:** 2026-04-11
**Branch:** `codex/machines-service-ticket-integration`
**Base:** `main`
**Scope:** Adds `machine_catalog` + `machine_instances` modules, integrates machines into `service_tickets` via cascade select
**Stats:** 89 files changed, ~167K insertions, 4 commits

---

## CRITICAL (Must Fix Before Merge)

### 1. Missing tenant scoping in machine commands — security vulnerability

Update/delete handlers in both machine modules query by `{ id, deletedAt: null }` only, without `tenantId`/`organizationId`. Any authenticated user can modify/delete records across tenants.

**Affected files:**
- `src/modules/machine_catalog/commands/machine-catalog.ts:54,80,124`
- `src/modules/machine_instances/commands/machine-instances.ts:58,95`

**Correct pattern** (from `service_tickets/commands/tickets.ts:152-158`):
```typescript
const existing = await em.findOne(ServiceTicket, {
  id: parsed.id,
  tenantId: scope.tenantId,
  organizationId: scope.organizationId,
  deletedAt: null,
} as FilterQuery<ServiceTicket>)
```

### 2. `fetchMachineById` uses wrong query parameter — cascade select broken

`machineOptions.ts:208` sends `?id=<uuid>` but the machine_instances route only checks for `ids` (plural) in `buildFilters`. Result: returns page 1 of ALL machines instead of the specific one. Breaks machine hydration on ticket edit pages.

**Fix:** Either add `id` support to the route's query schema and `buildFilters`, or change the API call in `machineOptions.ts` to use `?ids=<uuid>&pageSize=1`.

---

## IMPORTANT (Should Fix)

### 3. Sidebar icons use inline SVG instead of lucide-react

Per CLAUDE.md/AGENTS.md: "Sidebar icons MUST use `lucide-react` components — never inline SVG via `React.createElement`".

**Affected files:**
- `src/modules/machine_catalog/backend/machine-catalog/page.meta.ts:3-9`
- `src/modules/machine_instances/backend/machine-instances/page.meta.ts:3-19`

**Fix:** Import from `lucide-react`, e.g.:
```typescript
import { BookOpen } from 'lucide-react'
// icon: React.createElement(BookOpen, { size: 16 })
```

### 4. Migrations lack `IF NOT EXISTS` guards — not idempotent

Per CLAUDE.md: "Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency."

**Affected files:**
- `src/modules/machine_catalog/migrations/Migration20260411100002.ts`
- `src/modules/machine_instances/migrations/Migration20260411100001.ts`
- `src/modules/resources/migrations/Migration20260411100003.ts`

The service_tickets migration (`Migration20260411113000_service_tickets.ts`) does this correctly — use it as reference.

### 5. Pre-existing P1/P2 bugs not addressed

These CLAUDE.md-listed bugs remain unfixed:
- **P1 #2:** UTC timestamps fed into `datetime-local` inputs — timezone shift on save (`ticketFormConfig.tsx:182` still uses `.slice(0, 16)` on UTC string)
- **P1 #3:** Duplicate staff IDs accepted (`validators.ts:26` — no `.refine()` to reject duplicates)
- **P2 #4:** OpenAPI snake_case vs camelCase mismatch
- **P2 #5:** `visit_date`/`visit_end_date` accept any string, not ISO datetime

### 6. MachineCascadeSelect test mocks missing `{ virtual: true }`

`src/modules/service_tickets/components/__tests__/MachineCascadeSelect.test.tsx:13` mocks `@open-mercato/ui` paths without `{ virtual: true }`. Will fail if module paths don't resolve physically. The `machine_instances` route test does this correctly.

---

## SUGGESTIONS (Nice to Have)

### 7. Massive `.snapshot-hackaton.json` files (161K lines / 96% of diff)

Three snapshot files total ~161,000 lines. Given that `yarn mercato db generate` is broken for `@app` modules and migrations are manual, these snapshots may not be needed. Consider `.gitignore` or verifying they serve a purpose.

### 8. Create forms use raw UUID text inputs

Both `machine_catalog` and `machine_instances` create forms use `type: 'text'` with placeholder "UUID of catalog product" for FK fields. Should use `ComboboxInput` with lookup, similar to `MachineCascadeSelect`.

### 9. Events defined but never emitted

Both modules define events in `events.ts` and export emit functions, but command handlers never call them. The `service_tickets` module properly emits events after CRUD operations.

### 10. `part_template.updated` event missing

`src/modules/machine_catalog/events.ts` defines `part_template.created` and `part_template.deleted` but not `part_template.updated`, even though the update command exists.

### 11. Edit pages read only snake_case keys; list pages handle both

Edit pages (e.g., `machine_catalog/[id]/page.tsx:69-79`) read only snake_case keys from API responses. List page mappers handle both camelCase and snake_case. Inconsistent — edit pages will break if API normalizes to camelCase.

### 12. `siteAddress` JSON field lacks schema validation

`machineInstanceCreateSchema` accepts `siteAddress` as `z.record(z.string(), z.unknown())`, permitting arbitrary nested objects. Consider `z.record(z.string(), z.string())` or a specific address schema.

---

## What's Good

- Module structure consistently follows Open Mercato conventions
- Entity design correctly uses FK IDs (no cross-module ORM relations)
- Proper `tenantId`/`organizationId` on entities with composite indexes
- All API routes export `openApi`
- DataTable pagination properly wired (`page`, `pageSize`, `total`, `totalPages`, `onPageChange`)
- `MachineCascadeSelect` is well-designed: auto-fills customer/address from selected machine
- `machineOptions.ts` `readString`/`readNumber` helpers handle camelCase + snake_case defensively
- Dual en/pl i18n files provided for all modules
- Widget injection into catalog product detail pages is clean UMES usage
- Service tickets migration is idempotent and handles column rename correctly
- Role ACL migrations are thorough (null checks, non-array handling, partial feature presence)
- Tests cover key paths (MachineCascadeSelect, machine_instances route, updated ticketFormConfig)

---

## Verdict

**Block on the 2 critical issues** (tenant isolation vulnerability + broken machine lookup), then fix the important items. The architecture is solid overall — good module conventions and a thoughtful integration design.
