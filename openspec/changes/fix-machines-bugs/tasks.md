## 1. Sidebar Grouping Fix

- [x] 1.1 Add `pageGroupKey: 'machines.nav.group'` and `pageGroup: 'Machines'` to `src/modules/machine_catalog/backend/machine-catalog/create/page.meta.ts`
- [x] 1.2 Add `pageGroupKey: 'machines.nav.group'` and `pageGroup: 'Machines'` to `src/modules/machine_instances/backend/machine-instances/create/page.meta.ts`
- [x] 1.3 Run `yarn generate` to rebuild the page registry
- [x] 1.4 Verify in browser: all machine pages appear under single "MASZYNY" sidebar group (manual)

## 2. Edit Pages — Diagnose

- [x] 2.1 Add temporary `console.log` to machine instance edit page `useEffect` to log: `id` value, raw API response from `fetchCrudList`, and `data.items[0]` keys
- [x] 2.2 Open a machine instance edit page in browser, check console output to identify root cause (missing params, empty response, key mismatch, auth failure)
- [x] 2.3 Check browser Network tab for the `/api/machine_instances/machines?ids=...` request — confirm status code and response body

Root cause: machine routes lack `entityId` in list config, so `makeCrudRoute` takes fallback ORM path (`repo.find()`) returning camelCase entity properties. Edit pages only read snake_case keys → all values null.

## 3. Edit Pages — Fix

- [x] 3.1 Apply fix based on diagnosis (most likely: add dual-casing support to data mapper matching the list page's `readString(item, camelKey, snakeKey)` pattern)
- [x] 3.2 Apply same fix to machine catalog edit page (`machine_catalog/backend/machine-catalog/[id]/page.tsx`)
- [x] 3.3 Remove temporary console.log statements

## 4. Verify

- [x] 4.1 Open machine instance edit page for each of the 3 existing records — confirm fields are populated
- [x] 4.2 Open machine catalog edit page for each of the 3 existing profiles — confirm fields are populated
- [x] 4.3 Save an edited record and confirm the update persists
- [x] 4.4 Navigate to a non-existent ID and confirm error message is shown
