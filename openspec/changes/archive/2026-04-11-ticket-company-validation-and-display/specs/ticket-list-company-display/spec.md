## ADDED Requirements

### Requirement: Company name displayed in ticket list table

The ticket list table SHALL display the customer company name as a visible column.

#### Scenario: Ticket with company assigned
- **WHEN** coordinator views the ticket list
- **AND** a ticket has a `customerEntityId` set
- **THEN** the Company column displays the company name resolved from the customers module

#### Scenario: Ticket without company assigned
- **WHEN** coordinator views the ticket list
- **AND** a ticket has no `customerEntityId`
- **THEN** the Company column displays an empty cell (dash or blank)

#### Scenario: Company name resolution
- **WHEN** the ticket list is loaded
- **THEN** company names SHALL be resolved via response enrichment on the list API (not N+1 client-side fetches)

---

### Requirement: Company filter on ticket list

The ticket list SHALL support filtering by customer company via a searchable dropdown.

#### Scenario: Filter by company
- **WHEN** coordinator selects a company from the company filter dropdown
- **THEN** the table shows only tickets associated with that company
- **AND** the filter value is sent as `customer_entity_id` query parameter

#### Scenario: Clear company filter
- **WHEN** coordinator clears the company filter
- **THEN** the table shows tickets from all companies

#### Scenario: Company filter search
- **WHEN** coordinator types in the company filter dropdown
- **THEN** company options are searched via the customers API (`/api/customers/companies?search=`)
