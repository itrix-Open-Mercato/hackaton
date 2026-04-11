## 1. Technicians Module — P1 Type Error Fixes (unblock yarn typecheck)

- [x] 1.1 Fix `injection-table.ts`: convert from array to `ModuleInjectionTable` record keyed by spot ID; add both named `injectionTable` and `default` export; use module-namespaced widget IDs (D1)
- [x] 1.2 Fix `TechnicianMenuItem/widget.ts`: wrap bare `menuItems` array in `InjectionMenuItemWidget` object with `metadata`; default-export; use lucide-react icon name `HardHat` not `lucide:hard-hat`; add `features` array for ACL gating (D2)
- [x] 1.3 Fix `[id]/skills/route.ts` OpenAPI export: wrap `GET`/`POST`/`DELETE` keys inside `{ methods: { ... } }` shape; add `tag`, `summary`, `pathParams` (D3)
- [x] 1.4 Fix `[id]/certifications/route.ts` OpenAPI export: same `{ methods: { ... } }` wrapper as skills route (D3)
- [x] 1.5 Fix `[id]/edit/page.tsx` FormHeader: remove `onDelete` prop from edit-mode call; wire delete through supported `actions`/`actionsContent` if needed (D4)
- [x] 1.6 Fix `create/page.tsx` FormFooter: replace top-level `cancelHref`/`submitLabel`/`isSubmitting` with single `actions` object (D4)
- [x] 1.7 Fix `[id]/edit/page.tsx` FormFooter: same `actions` object fix as create page (D4)
- [x] 1.8 Run `yarn typecheck` and confirm all technicians module type errors are resolved

## 2. Technicians Module — P1 Runtime Fix + P2 Fixes

- [x] 2.1 Fix `create/page.tsx` redirect: read created ID from `apiCall()` return correctly (likely `res.result.id` instead of `res.id`); verify navigation goes to `/backend/technicians/<uuid>/edit` (D5)
- [x] 2.2 Fix `[id]/edit/page.tsx` notes handling: ensure empty string is sent as-is (or as `null`) so Zod schema maps it to `null`, not converted to `undefined` before send (D6)
- [x] 2.3 Fix `setup.ts` organization scoping: use each staff member's own `organization_id` when creating their technician profile, not `staffMembers[0].organization_id` for all (D7)
- [x] 2.4 Fix `TechnicianPicker/widget.tsx` query key: add organization scope to React Query key so org switch invalidates cached data (D8)

## 3. Service Ticket Edit Page — "Not Found" Fix

- [x] 3.1 Diagnose root cause: check how `buildFilters` handles the `id` query parameter in the service_tickets route; compare with machine_instances id filter fix (D9)
- [x] 3.2 Fix the filter or fetch logic so `fetchCrudList('service_tickets/tickets', { id, pageSize: 1 })` returns the ticket when it exists
- [x] 3.3 Verify the edit page loads an existing ticket without "Service ticket not found" error

## 4. Technician Picker Widget — Skills & Certifications

- [x] 4.1 Ensure technician list API response includes skills and certifications (add to `afterList` hook or enricher if not already included)
- [x] 4.2 Update `TechnicianPicker/widget.tsx` to display skills as tags and certifications for each technician entry
- [x] 4.3 Ensure picker pre-selects currently assigned technicians when editing an existing ticket
- [x] 4.4 Add search/filter support in the picker (filter by name or skill match)

## 5. Ticket View — Technician Details Display

- [x] 5.1 On ticket edit page, fetch assigned technician details via `/api/technicians/technicians` using staff member IDs from the ticket
- [x] 5.2 Display resolved technician names, skills, and certifications on the ticket edit view (inline on picker or as a read-only section)
- [x] 5.3 Handle empty state when no technicians are assigned

## 6. Regression Tests

- [x] 6.1 Test: technicians `injection-table.ts` exports a valid object (not array) with expected spot keys
- [x] 6.2 Test: technician create page uses correct ID from API response for redirect (not `undefined`)
- [x] 6.3 Test: clearing technician notes sends `null` or empty string (not `undefined`)
- [x] 6.4 Test: service ticket edit page loads ticket by ID without false "not found" error
- [x] 6.5 Test: technician picker writes selected IDs to `staff_member_ids` field
- [x] 6.6 Run `yarn typecheck` and `yarn test` to confirm everything passes

## 7. Verification

- [x] 7.1 Run `yarn generate` to regenerate widget registry with fixed injection-table and widget exports
- [x] 7.2 Run `yarn typecheck` — zero errors
- [x] 7.3 Run `yarn test` — all tests pass (20 suites, 101 tests)
- [ ] 7.4 Add Playwright integration test: create a technician through the backend UI and verify redirect to `/backend/technicians/<uuid>/edit`
- [ ] 7.5 Add Playwright integration test: open an existing service ticket edit page and verify no false "Service ticket not found" state appears
- [ ] 7.6 Add automated integration coverage: assign multiple technicians on a service ticket, save, reload, and verify persisted selection plus skills/certifications visibility
- [ ] 7.7 Run `yarn test:integration` for the new technician/service ticket coverage and confirm it passes
