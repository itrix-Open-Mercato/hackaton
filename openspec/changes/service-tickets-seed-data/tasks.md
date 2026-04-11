## 1. Create seed data file

- [x] 1.1 Create `src/modules/service_tickets/lib/seeds.ts` with declarative seed ticket definitions (8 tickets covering all statuses, service types, and priorities) using relative day-offsets for visit dates
- [x] 1.2 Implement cross-module lookup helpers using Knex: look up customers by `display_name` in `customer_entities`, staff by `display_name` in `staff_team_members`, products by `sku` in `catalog_products`
- [x] 1.3 Implement the `seedServiceTicketExamples` function that: checks idempotency (skip if any tickets exist), resolves cross-module references, creates tickets via `em.create(ServiceTicket, ...)`, creates assignments/parts/date-changes for select tickets, and flushes

## 2. Wire up setup hook

- [x] 2.1 Update `src/modules/service_tickets/setup.ts` to add a `seedExamples` hook that calls `seedServiceTicketExamples`

## 3. Tests

- [x] 3.1 Add unit tests for the seed function verifying: idempotency (no-op when tickets exist), correct ticket count created, relative date computation, graceful handling when cross-module entities are missing
