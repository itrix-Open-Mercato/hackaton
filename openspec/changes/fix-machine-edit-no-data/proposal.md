## Why

The machine catalog and machine instances edit pages fail to load data — users see "not found" or empty forms when navigating to `/backend/machine-catalog/[id]` or `/backend/machine-instances/[id]`. This blocks all machine management workflows. The root cause is missing tenant/organization scoping in command handlers: `findOne` queries in update and delete commands filter only by `id` + `deletedAt`, omitting `tenantId` and `organizationId`. While `makeCrudRoute` auto-scopes LIST queries (used by the edit page's `fetchCrudList` call), the command handlers that process saves and deletes are unscoped — creating a security hole and potential data corruption across tenants.

## What Changes

- Add `tenantId` and `organizationId` filters to all `em.findOne()` calls in `machine_catalog/commands/machine-catalog.ts` (profile update, profile delete, part template update, part template delete)
- Add `tenantId` and `organizationId` filters to all `em.findOne()` calls in `machine_instances/commands/machine-instances.ts` (instance update, instance delete)
- Implement `ensureScope(ctx)` helper in both modules (following `service_tickets` pattern) to extract authenticated scope from request context
- Verify that edit page data loading works end-to-end after fixes (the list endpoint is already scoped, so the root cause may also involve missing migrations or data seeding)

## Capabilities

### New Capabilities

_(none — this is a bugfix)_

### Modified Capabilities

- `tenant-scoping-fix`: Existing spec covers the requirements. Implementation was never applied. This change implements the spec on the `codex/machines-service-ticket-integration` branch.

## Impact

- **Files modified**: `machine_catalog/commands/machine-catalog.ts`, `machine_instances/commands/machine-instances.ts`
- **Security**: Closes cross-tenant data access vulnerability in update/delete operations
- **Branch**: Changes target `codex/machines-service-ticket-integration` where these modules live
- **Dependencies**: None — entities already have `tenantId`/`organizationId` fields and indexes; API routes already declare `tenantField`/`orgField`
