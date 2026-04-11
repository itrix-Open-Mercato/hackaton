## 1. Critical Fixes

- [x] 1.1 Implement skill filter in `api/technicians/route.ts` buildFilters — query technician_skills table and filter by matching technician IDs
- [x] 1.2 Create response enricher `data/enrichers.ts` targeting `service_tickets:service_ticket` — resolve assignments to technician profiles
- [x] 1.3 Fix create page to redirect to edit page after creation (so skills/certs can be managed immediately)

## 2. Warning Fixes

- [x] 2.1 Fix ticket history section in edit page to filter by staffMemberId (query service_ticket_assignments)
- [x] 2.2 Improve technician picker display — show skills prominently, better labels than truncated UUIDs

## 3. Unit Tests — Validators

- [x] 3.1 Create `data/__tests__/validators.test.ts` — test technicianCreateSchema, technicianUpdateSchema, skillAddSchema, certificationAddSchema with valid/invalid/edge-case inputs

## 4. Unit Tests — Commands

- [x] 4.1 Create `commands/__tests__/technicians.test.ts` — test create (success + duplicate 409), update, delete commands with mocked DataEngine/EntityManager

## 5. Integration / API Tests

- [x] 5.1 Create `__integration__/TC-TECHNICIANS-001.spec.ts` — full CRUD lifecycle test (create technician, add skills, add certifications, list with filters, update, delete)
- [x] 5.2 Add skill filter test — create technicians with different skills, verify skill query param returns correct results

## 6. Finalize

- [x] 6.1 Run `yarn generate` to pick up enrichers
- [x] 6.2 Run `yarn test` to verify all new + existing tests pass
