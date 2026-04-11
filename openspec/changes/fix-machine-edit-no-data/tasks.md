## 1. Scope machine catalog mutations

- [ ] 1.1 Add an `ensureScope(ctx)` helper to `machine_catalog` commands that reads authenticated `tenantId` and `organizationId` and fails fast when either is missing
- [ ] 1.2 Update machine catalog profile update/delete lookups to filter by `id`, `deletedAt`, `tenantId`, and `organizationId`
- [ ] 1.3 Update machine catalog part-template update/delete lookups to filter by `id`, `deletedAt`, `tenantId`, and `organizationId`

## 2. Scope machine instance mutations

- [ ] 2.1 Add an `ensureScope(ctx)` helper to `machine_instances` commands using the same authenticated-scope pattern as `service_tickets`
- [ ] 2.2 Update machine instance update/delete lookups to filter by `id`, `deletedAt`, `tenantId`, and `organizationId`

## 3. Add regression coverage

- [ ] 3.1 Add machine catalog command tests that prove in-scope update/delete mutations succeed
- [ ] 3.2 Add machine catalog command tests that prove cross-scope profile and part-template update/delete mutations return 404 without mutating data
- [ ] 3.3 Add machine instances command tests that prove in-scope update/delete mutations succeed
- [ ] 3.4 Add machine instances command tests that prove cross-scope update/delete mutations return 404 without mutating data

## 4. Verify the user-visible fix

- [ ] 4.1 Run the relevant automated test suite for machine catalog and machine instances command coverage
- [ ] 4.2 Verify the machine catalog and machine instances edit flows load and save correctly on the target branch
- [ ] 4.3 If edit flows still fail, document the remaining non-scoping issue as a follow-up instead of expanding this fix silently
