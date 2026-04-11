# Code Review: `feature/technicians`

**Date:** 2026-04-11
**Branch:** `feature/technicians`
**Base:** `main`
**Review target:** changes against merge base `498bcac99fb7e7fe85c230bf41e949a125b82e3b`

---

## Findings

### 1. [P1] Read the created technician id from `apiCall().result`

`apiCall()` returns an `ApiCallResult`, not the response body itself. Here `res.id` is always `undefined`, so a successful technician creation flashes success and then navigates to `/backend/technicians/undefined/edit`, leaving the user on a broken detail route even though the record was created.

**Location:** `src/modules/technicians/backend/technicians/create/page.tsx:35-46`

### 2. [P1] Register injection widgets with the supported table shape

`ModuleInjectionTable` is a record keyed by spot id, but this file exports an array of `{ widgetId, spots }` objects. That already breaks `yarn typecheck`, and at runtime the loader will not register either technicians widget, so the sidebar shortcut and the service-ticket picker never appear.

**Location:** `src/modules/technicians/widgets/injection-table.ts:3-5`

### 3. [P1] Export the sidebar menu widget as an injection module

The generated widget registry expects each widget file to default-export an injection widget object with `metadata`, but this file only exports a bare `menuItems` array. That is the cause of the `.mercato/generated/injection-widgets.generated.ts` type error, and even after fixing the table shape the menu item still will not load.

**Location:** `src/modules/technicians/widgets/injection/TechnicianMenuItem/widget.ts:3-10`

### 4. [P1] Wrap nested technician route docs under `methods`

`OpenApiRouteDoc` now expects a `{ methods: { GET: ... } }` shape. Using top-level `GET`/`POST` keys here makes `yarn typecheck` fail for this route, and the certifications sibling repeats the same pattern, so the branch cannot pass the required typecheck gate until both docs are wrapped correctly.

**Location:** `src/modules/technicians/api/technicians/[id]/skills/route.ts:94-100`

### 5. [P1] Stop passing detail-only props to edit-mode `FormHeader`

In edit mode `FormHeader` only accepts `actions`/`actionsContent`; `onDelete` belongs to detail mode. This call is one of the introduced type errors blocking `yarn typecheck`, so the new technician edit page will not compile until delete is wired through the supported API.

**Location:** `src/modules/technicians/backend/technicians/[id]/edit/page.tsx:226`

### 6. [P1] Pass an `actions` object to `FormFooter`

`FormFooter` no longer accepts `cancelHref`, `submitLabel`, and `isSubmitting` as top-level props; it expects a single `actions` object. The same direct-prop pattern appears on both create and edit pages, so the technicians UI still fails `yarn typecheck` even if the rest of the form logic is correct.

**Location:** `src/modules/technicians/backend/technicians/create/page.tsx:111-115`

### 7. [P2] Preserve `null` when the user clears technician notes

The update schema intentionally maps an empty string to `null` so notes can be cleared, but this submit path converts `''` to `undefined` before the request is sent. That turns “remove the current note” into “leave notes unchanged”, so existing notes can never be deleted from the edit form.

**Location:** `src/modules/technicians/backend/technicians/[id]/edit/page.tsx:190`

### 8. [P2] Seed technicians into each staff member's own organization

`staffMembers` is fetched across the whole tenant, but every seeded technician is written with `staffMembers[0].organization_id`. In a multi-organization tenant, any profile linked to `staffMembers[1]` or `[2]` ends up under the wrong organization, so it disappears from the technician list in that staff member’s real org and cannot be assigned from their service tickets.

**Location:** `src/modules/technicians/setup.ts:23-24`

### 9. [P2] Invalidate the technician picker when org scope changes

The picker’s query key never includes organization scope, so React Query reuses the previous organization’s technician list after the user switches scope on the service-ticket form. That leaves stale cross-org suggestions in the picker until a hard refresh, which is especially risky because assigning a technician writes staff member ids straight back into the ticket.

**Location:** `src/modules/technicians/widgets/injection/TechnicianPicker/widget.tsx:30-35`

---

## Verification Notes

- `yarn generate`: passed
- `yarn typecheck`: failed, including new technicians module type errors
- `yarn test`: failed in this workspace, partly outside the technicians module
- `yarn build`: could not complete because another `next build` instance held the lock at `.mercato/next/lock`
