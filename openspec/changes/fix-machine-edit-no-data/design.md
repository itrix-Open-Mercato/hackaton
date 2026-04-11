## Context

The machine catalog and machine instances modules already store `tenantId` and `organizationId` on their entities, and their CRUD route definitions already declare tenant and organization scope for list operations. Despite that, edit flows for existing records fail because the command handlers used during update and delete operations call `em.findOne()` with only `id` and `deletedAt`.

This creates two problems:

1. The save/delete path can miss the record that was loaded through a scoped list endpoint, causing "not found" or empty edit behavior.
2. The mutation path is not protected against cross-tenant access if an ID from another scope is provided.

The service tickets module already uses an `ensureScope(ctx)` helper to extract authenticated scope from the request context before performing scoped lookups. This change should follow the same pattern instead of inventing a new access model.

## Goals / Non-Goals

**Goals:**
- Make update and delete handlers in `machine_catalog` and `machine_instances` use authenticated tenant and organization scope for all `findOne()` lookups.
- Reuse the established `ensureScope(ctx)` pattern so both modules behave consistently with existing service modules.
- Restore reliable edit-page behavior for records that belong to the current tenant and organization.
- Close the cross-tenant mutation vulnerability without changing existing entity schemas or route contracts.
- Verify the fix end-to-end so we can distinguish a handler scoping bug from any unrelated data or migration issue.

**Non-Goals:**
- No entity or database migration changes.
- No UI redesign of the machine edit pages.
- No broader refactor of CRUD infrastructure or `makeCrudRoute`.
- No new capabilities; this is a corrective fix for existing behavior.

## Decisions

### Use per-module `ensureScope(ctx)` helpers modeled on `service_tickets`

Both command files will define a small helper that reads the authenticated `tenantId` and `organizationId` from request context and throws early if scope is unavailable.

Why:
- Keeps the fix local to the affected modules.
- Reuses a known project pattern, reducing implementation risk.
- Makes the security boundary explicit at the mutation layer.

Alternatives considered:
- Inline `tenantId` and `organizationId` extraction at each call site. Rejected because it duplicates logic and increases the chance of inconsistent checks.
- Rely on `makeCrudRoute` auto-scoping alone. Rejected because command mutations already bypass that protection.

### Scope every mutation lookup, not just the top-level edit action

All update/delete lookups in `machine_catalog/commands/machine-catalog.ts` and `machine_instances/commands/machine-instances.ts` will include `id`, `deletedAt: null`, `tenantId`, and `organizationId`.

Why:
- The bug affects multiple handlers in the same files, not a single code path.
- Partial fixes would leave security and behavior gaps behind.

Alternatives considered:
- Fix only the edit scenario currently observed in the UI. Rejected because delete and secondary handlers would remain vulnerable.

### Treat verification as part of the fix

After the code change, verification should cover both command-level behavior and the user-visible edit flow.

Why:
- The proposal notes a secondary possibility: missing migrations or seed data could also contribute to the symptom.
- A scoped command fix alone should be validated before assuming the UI problem is completely resolved.

Alternatives considered:
- Ship the handler patch without verification. Rejected because it would leave uncertainty about whether the reported bug is fully fixed.

## Risks / Trade-offs

- [Context shape differs from `service_tickets`] -> Mitigation: copy the proven helper pattern carefully and adapt only where module command signatures differ.
- [One or more `findOne()` paths are missed] -> Mitigation: audit every update/delete command in both files and verify all record fetches include scope fields.
- [Edit page still fails after command fix due to stale data or branch-specific issues] -> Mitigation: run end-to-end verification and capture any remaining failure as a follow-up bug rather than broadening this change silently.
- [Stricter scoping exposes existing bad test fixtures or orphaned data] -> Mitigation: update tests and seed assumptions to use records that belong to the authenticated tenant and organization.

## Migration Plan

No database migration is required because the change only updates query filters in command handlers.

Deployment steps:
- Apply the command-handler scoping fix in both modules.
- Run the relevant automated tests for machine catalog and machine instances commands.
- Verify editing existing records in the target branch environment.

Rollback:
- Revert the command-handler changes if an unexpected regression appears. Since there is no schema change, rollback is code-only and low risk.

## Open Questions

- Does the current edit-page symptom disappear completely once mutation lookups are scoped, or is there a second issue related to existing data on `codex/machines-service-ticket-integration`?
- Are there command tests already covering cross-tenant update/delete access for these modules, or should this change add them as part of verification?
