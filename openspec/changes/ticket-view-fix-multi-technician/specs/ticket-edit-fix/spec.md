## ADDED Requirements

### Requirement: Service ticket edit page SHALL load and display existing tickets without error

The service ticket edit page (`/backend/service-tickets/[id]/edit`) SHALL successfully load a ticket by UUID and render the edit form without displaying a "not found" error when the ticket exists in the database and belongs to the current tenant/organization.

#### Scenario: Edit page loads an existing ticket

- **WHEN** a coordinator navigates to `/backend/service-tickets/<valid-uuid>/edit` for a ticket that exists in their tenant and organization
- **THEN** the edit form SHALL render with the ticket's data populated in all fields
- **AND** no error message SHALL be displayed

#### Scenario: Edit page shows error for genuinely missing ticket

- **WHEN** a coordinator navigates to `/backend/service-tickets/<invalid-uuid>/edit` for a UUID that does not exist or belongs to a different tenant
- **THEN** an error message SHALL be displayed indicating the ticket was not found
- **AND** the edit form SHALL NOT render

#### Scenario: Edit page handles the id query parameter in API filter

- **WHEN** the edit page fetches a ticket via `fetchCrudList` with an `id` query parameter
- **THEN** the API route's filter builder SHALL correctly match the ticket by primary key UUID
- **AND** the response SHALL include exactly one item when the ticket exists
