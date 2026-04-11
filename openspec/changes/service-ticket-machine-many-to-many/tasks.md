## 1. Data Model And Validation

- [ ] 1.1 Remove the legacy single-machine ticket field from the `service_tickets` model and define `ServiceTicketMachine` as the new machine source of truth
- [ ] 1.2 Add `ServiceTicketMachinePart` and `ServiceTicketSkillRequirement` entities with tenant and organization scoping, primary ordering, and snapshot fields
- [ ] 1.3 Update service ticket validators and payload types to accept a `machineInstances` collection with nested planned parts and primary selection
- [ ] 1.4 Enforce machine uniqueness, tenant scoping, customer matching, and machine-part validation rules in the request layer

## 2. Ticket Persistence And Read Models

- [ ] 2.1 Implement transactional create and update logic that synchronizes linked machines, nested planned parts, and derived skill requirements in one save flow
- [ ] 2.2 Implement machine snapshot capture and catalog-context resolution for linked machines during ticket save
- [ ] 2.3 Implement derived skill and certification generation from machine catalog profiles for each linked machine
- [ ] 2.4 Update ticket list and detail read models to return the `machineInstances` collection, documentation shortcuts, derived requirements, and technician mismatch warnings
- [ ] 2.5 Add ticket query filters for linked `machineInstanceId` and derived requirement codes

## 3. Planned Parts And Documentation Context

- [ ] 3.1 Implement machine-scoped planned part persistence and ensure manual parts can only exist under a valid linked machine
- [ ] 3.2 Implement idempotent import of suggested planned parts from machine catalog part templates
- [ ] 3.3 Decide and apply the replacement strategy for the old ticket-level `ServiceTicketPart` model versus the new machine-scoped part model
- [ ] 3.4 Expose machine-specific documentation shortcut data from resolved machine catalog context in ticket responses

## 4. Backend Ticket UX

- [ ] 4.1 Replace the single-machine selector in the service ticket form with a collection-based machine editor that supports add, remove, reorder, and primary selection
- [ ] 4.2 Add nested planned-part editing and suggested-part import UI per linked machine in the ticket form
- [ ] 4.3 Show machine-specific documentation shortcuts and derived requirement details in ticket create, edit, and detail views
- [ ] 4.4 Surface technician mismatch warnings in the ticket UI without blocking save

## 5. Protocol Handoff

- [ ] 5.1 Extend protocol creation so it copies active linked machines into protocol-owned machine records
- [ ] 5.2 Copy planned machine parts into protocol-owned machine-part records and preserve the ticket-machine mapping
- [ ] 5.3 Ensure protocol machine and part data remain immutable relative to later ticket edits

## 6. Verification

- [ ] 6.1 Add validator and command tests covering duplicate machines, tenant/customer scoping, nested machine parts, and derived requirement generation
- [ ] 6.2 Add API tests covering collection-based ticket payloads, machine filters, requirement filters, and mismatch warning responses
- [ ] 6.3 Add component tests for multi-machine form behavior, primary selection, nested part editing, and warning rendering
- [ ] 6.4 Add protocol creation tests covering machine and planned-part copy behavior plus independence from later ticket changes
