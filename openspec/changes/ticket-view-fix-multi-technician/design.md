## Context

The `feature/technicians` branch introduced a technicians module with profiles, skills, certifications, and a picker widget for service ticket assignment. A code review (`reviews/feature-technicians-2026-04-11.md`) found 6 P1 and 3 P2 issues that prevent `yarn typecheck` from passing and break core workflows (create redirect, widget registration, sidebar menu). Separately, the service ticket edit page shows "Service ticket not found" despite rendering data.

The technicians module follows older manual form patterns while the service_tickets module uses the current `CrudForm` abstraction. Widget exports use wrong shapes compared to working examples in `machine_catalog` and `example` modules.

## Goals / Non-Goals

**Goals:**
- Fix all 9 review findings so `yarn typecheck` and `yarn build` pass
- Fix service ticket edit "not found" error
- Working multi-technician picker on ticket form with skills and certifications visible
- Assigned technician details (name, skills, certs) displayed on ticket edit view
- Regression tests covering the bug fixes and new behavior

**Non-Goals:**
- Migrating technician create/edit pages from manual forms to CrudForm (works as-is once props are fixed; refactor is a separate change)
- Skill-based auto-matching or recommendation engine
- Technician availability/schedule checking during assignment
- Certification expiry warnings during assignment

## Decisions

### D1: Fix injection-table.ts to use object-keyed shape

The current file exports an array of `{ widgetId, spots }` objects. The framework expects a `ModuleInjectionTable` record keyed by spot ID with widget config objects as values.

**Correct shape** (from `machine_catalog/widgets/injection-table.ts`):
```typescript
export const injectionTable: ModuleInjectionTable = {
  'menu:sidebar:main': {
    widgetId: 'technicians.injection.TechnicianMenuItem',
    priority: 30,
  },
  'crud-form:service_tickets:service_ticket': {
    widgetId: 'technicians.injection.TechnicianPicker',
    priority: 20,
  },
}
export default injectionTable
```

Both named `injectionTable` and `default` exports are required (Turbopack constraint from CLAUDE.md).

**Alternative considered:** Patching the loader to accept arrays — rejected because it would diverge from every other module.

### D2: Fix sidebar menu widget to use InjectionMenuItemWidget type

The current file exports a bare `menuItems` array. The generated widget registry expects a default-exported object with `metadata` and `menuItems`.

**Correct shape** (from `example/widgets/injection/example-menus/widget.ts`):
```typescript
const widget: InjectionMenuItemWidget = {
  metadata: { id: 'technicians.injection.TechnicianMenuItem' },
  menuItems: [{ id: 'technicians-list', labelKey: '...', icon: 'HardHat', href: '/backend/technicians', features: ['technicians.view'], placement: { ... } }],
}
export default widget
```

Icon must be a lucide-react component name (`HardHat`), not a `lucide:hard-hat` string prefix.

### D3: Fix OpenAPI route docs to use `methods` wrapper

Nested routes (`[id]/skills/route.ts`, `[id]/certifications/route.ts`) use flat `GET`/`POST` keys. The `OpenApiRouteDoc` type expects `{ methods: { GET: ..., POST: ... } }`.

**Correct shape** (from `example/api/blog/[id]/route.ts`):
```typescript
export const openApi: OpenApiRouteDoc = {
  tag: 'Technicians',
  summary: 'Technician skills',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: { GET: skillGetDoc, POST: skillPostDoc, DELETE: skillDeleteDoc },
}
```

### D4: Fix FormHeader and FormFooter prop shapes

**FormHeader in edit mode:** Remove `onDelete` (detail-mode only). Edit mode accepts `actions`/`actionsContent`.

**FormFooter:** Replace top-level `cancelHref`/`submitLabel`/`isSubmitting` with `actions` object:
```typescript
<FormFooter actions={{ cancel: { href: '/backend/technicians' }, submit: { label: t('...'), isSubmitting } }} />
```

This fix applies to both `create/page.tsx` and `[id]/edit/page.tsx`.

### D5: Fix technician create redirect

The create page reads `res.id` from the `apiCall()` return. The `apiCall()` wrapper returns `{ result, error }` — the actual ID is at `res.result.id`. Verify the exact return shape at runtime and fix the access path.

### D6: Preserve null when clearing technician notes

The edit page submit handler converts empty string to `undefined` before sending. The update schema intentionally maps `''` → `null` so notes can be cleared. Fix: send empty string as-is and let the Zod schema handle the transform, or explicitly send `null`.

### D7: Fix seed data organization scoping

Current code takes `staffMembers[0].organization_id` for all seeded technicians. Fix: use each staff member's own `organization_id` when creating their technician profile.

### D8: Add organization scope to technician picker query key

Include the current organization context in the React Query key so switching orgs invalidates stale data:
```typescript
queryKey: ['technicians-picker', search, organizationId]
```

The `organizationId` can be obtained from the form context or user session.

### D9: Diagnose and fix service ticket edit "not found" error

The edit page calls `fetchCrudList('service_tickets/tickets', { id, pageSize: 1 })`. If the response returns empty `items`, it throws "not found". Possible causes:
1. The API route's `buildFilters` doesn't handle the `id` query parameter correctly
2. Tenant/org scoping mismatch between the authenticated user and the ticket
3. The `id` param format doesn't match what the filter expects

**Approach:** Check how `buildFilters` handles `id` in the service_tickets route. Compare with the machine_instances route which had a similar `id` filter fix (spec `machine-lookup-fix`). The fix is likely adding `if (q.id) F.id = q.id` to the filter builder if missing, or fixing the filter to accept a single UUID.

### D10: Technician picker widget on ticket form

The picker is already scaffolded at `technicians/widgets/injection/TechnicianPicker/widget.tsx`. Once the injection-table (D1) and widget export shapes are fixed, the picker should register on the `crud-form:service_tickets:service_ticket` slot.

The picker must:
- Fetch active technicians via `/api/technicians/technicians?is_active=true`
- Display each technician's name, skills (as tags), and certifications
- Support multi-select writing to `staff_member_ids`
- Include org scope in the query key (D8)

The technician list API already includes skills in responses. Certifications need to be fetched per-technician or included via response enrichment.

**Alternative considered:** Fetching technician data via a dedicated picker endpoint that bundles skills+certs — rejected in favor of enriching the existing list endpoint, since skills are already included and certifications can be added similarly.

### D11: Technician details display on ticket view

When viewing/editing a ticket, assigned technician UUIDs should resolve to names with skills and certifications shown. Two approaches:

**Chosen:** Fetch technician details client-side after ticket loads. The edit page already has the `staff_member_ids` from the ticket response — make a secondary API call to `/api/technicians/technicians?staff_member_id=<ids>` to resolve names, skills, and certs. Display as a read-only section or inline on the picker widget showing current assignments.

**Alternative considered:** Server-side response enricher on the ticket API — cleaner but requires cross-module entity access which triggers Turbopack CJS errors. Raw Knex query would work but adds complexity. Client-side fetch is simpler and consistent with how the picker already fetches data.

## Risks / Trade-offs

**[Risk] Turbopack CJS errors from cross-module imports** → All technician data access from the service tickets UI goes through API calls, never direct entity imports. This is already the established pattern.

**[Risk] Stale picker data across org switches** → D8 adds org scope to query key. If org context isn't available in the picker widget's scope, we may need to thread it through the injection slot's props.

**[Risk] Performance with many technicians** → The picker fetches with `pageSize: 50`. For orgs with 50+ technicians, add search-as-you-type filtering. The existing `search` query parameter on the technicians API already supports this.

**[Risk] Certifications not in list response** → If the technician list API doesn't include certifications, we'll need to add them to the response or make per-technician detail calls. Adding to the list response is preferred (one request vs N).

**[Trade-off] Client-side resolution vs server-side enricher** → Client-side is simpler but means an extra API call on ticket load. Acceptable for a hackathon; enricher can be added later when Turbopack constraints relax.
