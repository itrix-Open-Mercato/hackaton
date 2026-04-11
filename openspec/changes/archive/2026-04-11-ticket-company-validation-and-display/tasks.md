## 1. Contact Person → Company Validation

- [x] 1.1 Add `validateContactPersonBelongsToCompany(contactPersonId, customerEntityId, ctx)` helper in `commands/tickets.ts` — fetches `/api/customers/companies/{id}?include=people`, checks person membership, throws `CrudHttpError(422, ...)` on mismatch
- [x] 1.2 Call the validator in `createTicketCommand.execute()` after parsing input, before entity creation — only when both `contactPersonId` and `customerEntityId` are provided
- [x] 1.3 Call the validator in `updateTicketCommand.execute()` after parsing input, before entity update — handle the case where only one of the two fields changed (resolve the other from the existing entity)
- [x] 1.4 Add EN/PL translation keys for the validation error message

## 2. Company Name Enricher

- [x] 2.1 Create `src/modules/service_tickets/data/enrichers.ts` implementing `ResponseEnricher` — `enrichMany` batch-fetches company names by unique `customerEntityId` values, returns `_service_tickets.companyName` on each record
- [x] 2.2 Register the enricher in the module's `index.ts` exports

## 3. Company Column in Ticket List Table

- [x] 3.1 Add `companyName` column definition to `buildColumns()` in `ServiceTicketsTable.tsx` — reads from enriched response field, displays company name or dash if empty

## 4. Company Filter in Ticket List Table

- [x] 4.1 Add async company filter dropdown to `ServiceTicketsTable.tsx` — searches `/api/customers/companies?search=` for options, sends selected value as `customer_entity_id` query parameter

## 5. Unit Tests

- [x] 5.1 Add tests for `validateContactPersonBelongsToCompany` in `commands/__tests__/tickets.test.ts` — cover all 6 spec scenarios: valid pair, invalid pair, person without company, company without person, neither set, company cleared with person set
- [x] 5.2 ~~Add test for API route `transformItem`~~ — N/A: enrichers inject `_service_tickets.companyName` at framework level after `transformItem`, no route-level change to test
