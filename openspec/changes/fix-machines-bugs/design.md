## Context

The `machine_catalog` and `machine_instances` modules are `@app` modules registered in `src/modules.ts`. Both have working list pages (data renders correctly) and working API endpoints. However:

1. The sidebar shows two extra groups (`MACHINE_CATALOG`, `MACHINE_INSTANCES`) containing the "create" page entries, separate from the unified "MASZYNY" group that contains the list pages.
2. Edit pages (`[id]/page.tsx`) in both modules render CrudForm with empty `fallback` values — the async data load via `fetchCrudList` either fails silently or never populates `initial`.
3. The "Powiązane rekordy" section on service tickets is the `MachineCascadeSelect` component working as designed — not a bug.

**Current state of the code:**
- List pages use `apiCall` directly and handle both camelCase/snake_case keys — working.
- Edit pages use `fetchCrudList` (which calls `readApiResultOrThrow`) with `{ ids: id, pageSize: 1 }` — empty result.
- CrudForm does support `initialValues` changes via `useLayoutEffect` with JSON snapshot comparison.
- Both modules use `pageGroupKey: 'machines.nav.group'` on their list `page.meta.ts`, but create `page.meta.ts` files have no `pageGroupKey` at all.
- Next.js 16.1.7 with `"use client"` page components using `params?.id` (same pattern as core modules and service_tickets).

## Goals / Non-Goals

**Goals:**
- Unify all machine sidebar entries under a single "MASZYNY" group
- Make edit pages load and display existing record data
- Keep fixes minimal and scoped (hackathon context)

**Non-Goals:**
- Refactoring list pages or API routes (they work)
- Adding detail pages (only CrudForm edit pages exist currently)
- Modifying the `MachineCascadeSelect` component or "Powiązane rekordy" section

## Decisions

### 1. Sidebar: Fix create page grouping

**Decision**: Add `pageGroupKey: 'machines.nav.group'` and `pageGroup: 'Machines'` to the create `page.meta.ts` files for both modules, so all machine pages (list + create) appear under the unified "MASZYNY" sidebar group.

**Rationale**: The list pages already use `pageGroupKey: 'machines.nav.group'` and render correctly under "MASZYNY". The create pages lack any `pageGroupKey`, causing the framework to fall back to the module ID as a section header (`MACHINE_CATALOG`, `MACHINE_INSTANCES`). Adding the matching group key unifies them.

**Alternative considered**: `navHidden: true` — would hide create pages from sidebar entirely, but the user wants to keep them visible, just grouped correctly.

### 2. Edit pages: Diagnose and fix the data load

**Decision**: Use a two-step approach:

**Step A — Runtime diagnosis**: Add temporary `console.log` statements to the edit page `useEffect` to trace:
- Whether `id` is present (params resolution)
- What `fetchCrudList` returns (API response shape)
- Whether `data.items[0]` exists and what keys it contains

**Step B — Apply the fix based on diagnosis**. Most likely root causes ranked by probability:

1. **API returns data but mapping misses keys**: The edit pages only map snake_case (`instance_code`, `serial_number`), but the API might return camelCase in single-record contexts. Fix: add dual-casing support like the list page's `readString(item, 'camelKey', 'snake_key')` pattern.

2. **`fetchCrudList` receives a non-200 response silently**: `readApiResultOrThrow` should throw, but if authentication cookies aren't forwarded from the client-side `useEffect`, the API might return a redirect (302) which fails parsing. Fix: ensure `fetchCrudList` includes credentials.

3. **`ids` filter mismatch**: The `buildFilters` function checks `typeof query.ids === 'string'` which should work, but the query parameter might be serialized differently by `buildCrudQuery`. Fix: verify the URL in browser DevTools Network tab.

**Rationale**: Blind guessing is slower than runtime diagnosis. The edit page code is structurally identical to the working service_tickets edit page, so the difference is in data/runtime behavior, not code structure.

### 3. Run `yarn generate` after metadata changes

**Decision**: Run `yarn generate` after modifying any `page.meta.ts` file to regenerate the framework's page registry.

**Rationale**: The framework auto-discovers pages during generation. Stale generated output could explain why the sidebar doesn't reflect the current `pageGroupKey` settings.

## Risks / Trade-offs

- **[Risk] Runtime diagnosis delay**: Requires running the dev server and checking browser console.
  → **Mitigation**: The diagnosis step should take <5 minutes and avoids wasting time on wrong fixes.

- **[Risk] `navHidden` might not be supported**: Not all frameworks support this metadata field.
  → **Mitigation**: If `navHidden` doesn't work, fall back to adding `pageGroupKey` instead, which we know works from the list pages.

- **[Risk] Edit page fix might require changes beyond just data mapping**: E.g., if the issue is auth cookie forwarding.
  → **Mitigation**: If `fetchCrudList` doesn't work reliably, switch to the pattern used by the list page (`apiCall` + manual URL construction + dual-casing mapper), which is proven to work.
