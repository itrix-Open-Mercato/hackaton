## ADDED Requirements

### Requirement: Seed example service tickets

The system SHALL seed 8 example service tickets when `seedExamples` runs for the service_tickets module. Tickets SHALL span all statuses (`new`, `scheduled`, `in_progress`, `completed`, `cancelled`), all service types (`commissioning`, `regular`, `warranty_claim`, `maintenance`), and all priorities (`normal`, `urgent`, `critical`).

#### Scenario: First initialization with examples
- **WHEN** `seedExamples` runs for a tenant/organization with zero existing tickets
- **THEN** 8 tickets are created with ticket numbers SRV-000001 through SRV-000008
- **AND** each ticket has a service type, status, priority, and description

#### Scenario: Idempotent re-run
- **WHEN** `seedExamples` runs for a tenant/organization that already has tickets
- **THEN** no new tickets are created
- **AND** existing data is not modified

### Requirement: Cross-reference seeded customers

Seed tickets SHALL reference customer entities (companies and contact people) from the core customers module by looking up `display_name` in the `customer_entities` table.

#### Scenario: Customers exist
- **WHEN** core customer seeds have run before service ticket seeds
- **THEN** tickets reference the matching company and contact person by ID

#### Scenario: Customers not seeded
- **WHEN** core customer seeds have not run
- **THEN** tickets are created with `customerEntityId` and `contactPersonId` set to null

### Requirement: Cross-reference seeded staff members

Seed tickets SHALL create staff assignments referencing team members from the core staff module by looking up `display_name` in the `staff_team_members` table.

#### Scenario: Staff exist
- **WHEN** core staff seeds have run before service ticket seeds
- **THEN** `ServiceTicketAssignment` records are created linking tickets to staff members

#### Scenario: Staff not seeded
- **WHEN** a referenced staff member is not found
- **THEN** the assignment is silently skipped (no error)

### Requirement: Cross-reference seeded catalog products as parts

Seed tickets SHALL create parts referencing products from the core catalog module by looking up `sku` in the `catalog_products` table. These references are placeholders until the resources module provides machine component parts.

#### Scenario: Products exist
- **WHEN** core catalog seeds have run before service ticket seeds
- **THEN** `ServiceTicketPart` records are created with product IDs, quantities, and notes

#### Scenario: Products not seeded
- **WHEN** a referenced product SKU is not found
- **THEN** the part is silently skipped (no error)

### Requirement: Seed date change audit records

Select seed tickets SHALL include `ServiceTicketDateChange` records to demonstrate the date rescheduling audit trail.

#### Scenario: Ticket with date change history
- **WHEN** a seed ticket is defined with date changes
- **THEN** `ServiceTicketDateChange` records are created with old date, new date, and reason

### Requirement: Relative visit dates

Seed ticket visit dates SHALL be computed as day-offsets from the current date so the demo data always looks current.

#### Scenario: Date computation
- **WHEN** seed data defines a visit date offset of -14
- **THEN** the stored `visitDate` is 14 days before the current date, normalized to 09:00 local time
