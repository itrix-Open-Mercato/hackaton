## MODIFIED Requirements

### Requirement: Seed example service tickets

The existing decision "No seed data in setup.ts" is reversed. The `service_tickets` module setup SHALL include a `seedExamples` hook that populates demo tickets.

#### Scenario: seedExamples hook registered
- **WHEN** the module's `setup.ts` is loaded by the framework
- **THEN** a `seedExamples` function is available and calls `seedServiceTicketExamples`
