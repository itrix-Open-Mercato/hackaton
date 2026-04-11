## Context

The `codex/machines-service-ticket-integration` branch adds `machine_catalog` and `machine_instances` modules with a cascade select integration into `service_tickets`. A code review found 2 critical bugs (tenant scoping vulnerability, broken machine lookup), 4 important issues (convention violations, pre-existing P1/P2 bugs in service_tickets), and 6 suggestions.

The branch uses `makeCrudRoute` for API endpoints. The route-level `mapInput` calls `parseScopedCommandInput` to inject tenant/org scope into create payloads, but command handlers for update/delete query by `{ id, deletedAt: null }` only — missing scope in the filter. The list endpoint returns raw snake_case column names via the `fields` array, while MikroORM entity serialization in detail endpoints returns camelCase.

All changes target the branch, not main. The work is on a hackathon timeline.

## Goals / Non-Goals

**Goals:**
- Close the cross-tenant security vulnerability in machine commands
- Fix cascade select machine hydration so the integration actually works
- Fix pre-existing P1/P2 bugs in service_tickets (duplicate staff IDs, date validation, UTC handling, OpenAPI casing)
- Bring sidebar icons and migrations in line with project conventions
- Write regression tests BEFORE fixes for all 6 behavior bugs

**Non-Goals:**
- Refactoring command architecture or extracting shared utilities beyond what's needed
- Fixing suggestions #7-12 (snapshot bloat, raw UUID inputs, events not emitted, etc.) — these are nice-to-haves post-merge
- Adding new features to the machine modules
- Changing the overall snake_case/camelCase strategy across the platform

## Decisions

### D1: Tenant scoping — add `ensureScope` to each machine command file

`ensureScope` is a private function in `service_tickets/commands/tickets.ts`. Rather than extracting it to a shared package (overkill for hackathon), copy the pattern into each machine module's command file. Each command handler will:
- Call `ensureScope(ctx)` to get authenticated `tenantId`/`organizationId`
- Use scope values (not input values) in `em.create()` for create handlers
- Add `tenantId` and `organizationId` to `em.findOne()` filters for update/delete handlers

**Alternative considered:** Import from service_tickets module — rejected because cross-module imports violate the architecture (modules are isolated). A shared lib extraction is the right long-term move but not for a hackathon fix.

### D2: Machine lookup — add singular `id` to listSchema and buildFilters

The client (`machineOptions.ts:208`) sends `?id=<uuid>` but the route only handles `ids` (plural). Fix the route, not the client, because:
- The route should support both `id` (single lookup) and `ids` (batch) — this is a standard REST pattern
- Changing the client could break other callers that may also use singular `id`

Add `id: z.string().uuid().optional()` to `listSchema` and handle it in `buildFilters` with `ids` taking precedence when both are present.

### D3: UTC datetime — convert via `Date` object in `mapTicketToFormValues`

The codebase has no timezone utility. The current code does `utcString.slice(0, 16)` which displays UTC time in a local datetime-local input — wrong by the user's timezone offset.

Fix: construct a `Date` object from the UTC string (JavaScript parses to local time automatically), then format as `YYYY-MM-DDTHH:mm` using local getters:

```
const d = new Date(utcString)
const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
```

This uses the browser's timezone, which is correct for an admin UI where the user's local time matters.

**Alternative considered:** Use `Intl.DateTimeFormat` — rejected because formatting to `YYYY-MM-DDTHH:mm` is awkward with Intl. Also considered server-side timezone conversion — rejected because the server doesn't know the user's timezone.

### D4: OpenAPI casing — change schema to match snake_case API output

The list endpoint returns snake_case (raw DB column names via the `fields` array in `makeCrudRoute`). The `ticketListItemSchema` already uses snake_case. The review flagged a mismatch, but the list endpoint and schema actually agree on snake_case. The real issue is that `mapTicketToFormValues` expects camelCase (from detail/edit endpoints using MikroORM serialization).

Fix: keep the OpenAPI schema in snake_case (matching list output). Ensure `mapTicketToFormValues` handles both casings defensively — check for both `item.visitDate` and `item.visit_date`, similar to how `machineOptions.ts` already does with `readString`/`readNumber` helpers.

### D5: Date validation — custom ISO 8601 regex in Zod

Replace `optionalStr` for `visit_date`/`visit_end_date` with a Zod string that validates against an ISO 8601 datetime pattern. The regex should accept:
- Full ISO: `2026-04-15T09:00:00.000Z`
- With offset: `2026-04-15T09:00:00+02:00`
- datetime-local format: `2026-04-15T09:00`

Use `z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)` as the base check — this covers all three formats while rejecting arbitrary strings like "next tuesday".

### D6: Duplicate staff IDs — Zod `.refine()` on the array

Add `.refine(ids => !ids || new Set(ids).size === ids.length, { message: 'Duplicate staff member IDs are not allowed' })` to both `ticketCreateSchema` and `ticketUpdateSchema` for the `staff_member_ids` field.

### D7: Convention fixes — direct edits, no design complexity

- **Sidebar icons:** Replace inline `React.createElement('svg', ...)` with `import { X } from 'lucide-react'` + `React.createElement(X, { size: 16 })`. Pick appropriate icons (`Cpu` for machine catalog, `HardDrive` for machine instances, or similar).
- **Migration idempotency:** Add `IF NOT EXISTS` to `CREATE TABLE` and `IF EXISTS` to `DROP TABLE` in all three machine migration files.
- **Test mock fix:** Add `{ virtual: true }` to the `jest.mock()` call in MachineCascadeSelect test.

## Risks / Trade-offs

- **[Risk] Copying `ensureScope` creates duplication** → Acceptable for hackathon. If a 4th module needs it, extract to shared lib then.
- **[Risk] Date regex may reject valid edge-case ISO formats** → The regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}` is permissive enough for all practical inputs from datetime-local HTML inputs and ISO timestamps.
- **[Risk] Dual-casing in `mapTicketToFormValues` is a band-aid** → True, but normalizing casing across all endpoints is a larger refactor. The defensive read pattern is proven (machineOptions.ts already does it).
- **[Risk] Local timezone conversion depends on browser timezone** → This is correct behavior for an admin UI. Server-stored UTC + client-side local display is the standard pattern.

## Open Questions

- Should `ensureScope` be extracted to `@open-mercato/shared/lib/api/scoped` now, or defer? (Recommendation: defer, revisit when technicians module is built)
- Should the casing normalization for OpenAPI be tackled as a separate change? (Recommendation: yes, as a post-merge cleanup)
