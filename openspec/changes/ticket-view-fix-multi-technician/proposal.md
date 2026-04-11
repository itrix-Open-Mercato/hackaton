## Why

The service ticket edit view shows a "Service ticket not found" error despite actually rendering ticket data. This blocks coordinators from editing existing tickets. The edit form has no UI for assigning technicians — the `staff_member_ids` field is accepted by the API but there's no picker widget on the form. Technician skills and certifications are stored in the `technicians` module but are invisible during ticket assignment.

Beyond the ticket view, a code review of the `feature/technicians` branch (`reviews/feature-technicians-2026-04-11.md`) uncovered 6 P1 and 3 P2 issues that prevent the technicians module from compiling or functioning correctly. These must be fixed before the picker and display features can work end-to-end.

## What Changes

### Service Ticket Edit Fix
- **Fix "Service ticket not found" error on edit page** — diagnose and fix the data-loading logic that shows the error despite the ticket existing

### Technicians Module — Review Fixes (from `reviews/feature-technicians-2026-04-11.md`)
- **[P1] Fix technician create redirect** — `apiCall().result` not being read correctly; navigation goes to `/technicians/undefined/edit` after successful creation (`create/page.tsx:35-46`)
- **[P1] Fix injection-table export shape** — file exports an array instead of the expected `ModuleInjectionTable` record, breaking widget registration (`widgets/injection-table.ts:3-5`)
- **[P1] Fix sidebar menu widget export** — widget file exports bare `menuItems` array instead of a default-exported injection widget object with `metadata` (`widgets/injection/TechnicianMenuItem/widget.ts:3-10`)
- **[P1] Fix OpenAPI route docs for nested routes** — `skills` and `certifications` sub-routes use top-level `GET`/`POST` keys instead of `{ methods: { GET: ... } }` shape (`api/technicians/[id]/skills/route.ts:94-100`)
- **[P1] Fix FormHeader props in edit mode** — passing detail-only `onDelete` prop in edit mode causes type error (`[id]/edit/page.tsx:226`)
- **[P1] Fix FormFooter props** — passing `cancelHref`/`submitLabel`/`isSubmitting` as top-level props instead of `actions` object, on both create and edit pages (`create/page.tsx:111-115`)
- **[P2] Preserve null when clearing technician notes** — empty string converted to `undefined` instead of `null`, making it impossible to clear notes (`[id]/edit/page.tsx:190`)
- **[P2] Fix seed data organization scoping** — all seeded technicians written with first staff member's org ID regardless of actual staff member org (`setup.ts:23-24`)
- **[P2] Invalidate technician picker on org scope change** — React Query key missing organization scope, causing stale cross-org suggestions (`TechnicianPicker/widget.tsx:30-35`)

### Multi-Technician Assignment UI
- **Add multi-technician picker to ticket form** — multi-select widget showing active technicians with name, skills (tags), and certifications; writes to `staff_member_ids`
- **Display assigned technician details on ticket view** — show names, skills, and certifications instead of raw UUIDs

### Regression Tests
- Cover the edit-page loading bug, technician module fixes, and multi-technician assignment behavior

## Capabilities

### New Capabilities

- `ticket-edit-fix`: Fix for the service ticket edit page "not found" error — diagnose root cause in the fetch/state logic and correct it
- `technician-picker-widget`: Multi-select technician picker on the service ticket form showing names, skills, and certifications
- `ticket-view-technician-display`: Display assigned technician details (name, skills, certificates) on the ticket edit/detail view
- `technician-module-review-fixes`: Fix all 9 issues from the code review — type errors, widget registration, create redirect, notes clearing, seed scoping, and picker cache invalidation

### Modified Capabilities

- `regression-tests`: Add regression tests covering the edit-page loading bug, technician module fixes, and multi-technician assignment behavior
- `technician-ticket-assignment`: Extend the assignment spec to include skills and certifications display in the picker and on ticket detail

## Impact

- **Technicians module**: 8+ files modified across `backend/`, `widgets/`, `api/`, `setup.ts` — fixes required before `yarn typecheck` can pass
- **Service tickets module**: `backend/service-tickets/[id]/edit/page.tsx` (bug fix), ticket form config, technician display components
- **Cross-module**: Technicians module data (skills, certifications) surfaced in service tickets UI — uses API calls, not direct entity imports (Turbopack constraint)
- **API**: Technician list endpoint needs to include skills/certifications in response for picker data
- **Tests**: New test files in `src/modules/service_tickets/__tests__/` and `src/modules/technicians/__tests__/`
- **No breaking changes** — existing `staff_member_ids` API contract is preserved
