## Why

The machine modules (`machine_catalog` and `machine_instances`) have three visible bugs that break usability: the sidebar shows disconnected navigation groups instead of a unified "Maszyny" section, edit pages for both modules render empty forms despite data existing in the database, and the "Powiązane rekordy" data source on service tickets is undocumented/unclear. These are blocking the machine management workflow during the hackathon.

## What Changes

- **Fix sidebar grouping**: The create page entries (`Nowy profil maszyny`, `Nowy egzemplarz maszyny`) appear under separate `MACHINE_CATALOG` / `MACHINE_INSTANCES` sidebar sections instead of being grouped under the unified "MASZYNY" group. The list pages have correct `pageGroupKey: 'machines.nav.group'` but the create pages lack `pageGroupKey` entirely, causing the framework to fall back to module ID as the section header. Fix by either hiding create pages from the sidebar or adding matching `pageGroupKey`.
- **Fix empty edit pages**: Both `machine_instances/backend/machine-instances/[id]/page.tsx` and `machine_catalog/backend/machine-catalog/[id]/page.tsx` render blank forms despite the list pages showing data. The edit pages use `fetchCrudList` with `ids` filter and map snake_case keys. Root cause needs investigation — likely a `CrudForm` reactivity issue where `initialValues` set via `initial ?? fallback` doesn't re-initialize the form after async data loads, or a Next.js 16 params resolution issue.
- **Document "Powiązane rekordy" data source**: The related-records section visible on service ticket edit forms (Image #4) comes from `MachineCascadeSelect` component (`service_tickets/components/MachineCascadeSelect.tsx`). It fetches machine instance data, then loads the linked catalog profile and part templates via `machineOptions.ts` helpers calling the `machine_instances` and `machine_catalog` APIs. This is working as designed — not a bug, but the data flow should be understood.

## Capabilities

### New Capabilities

_(none — this is a bugfix change)_

### Modified Capabilities

- `machine-sidebar-nav`: Fix create page metadata to use shared `pageGroupKey` so sidebar groups are unified
- `machine-edit-pages`: Fix data loading in machine instance and catalog edit pages so forms populate correctly

## Impact

- **Files**: `src/modules/machine_catalog/backend/machine-catalog/create/page.meta.ts`, `src/modules/machine_instances/backend/machine-instances/create/page.meta.ts`, `src/modules/machine_catalog/backend/machine-catalog/[id]/page.tsx`, `src/modules/machine_instances/backend/machine-instances/[id]/page.tsx`
- **APIs**: No API changes expected — the list endpoints already work correctly
- **Dependencies**: None — these are isolated UI/metadata fixes within the machine modules
- **Risk**: Low — changes are scoped to page metadata and client-side data loading
