## ADDED Requirements

### Requirement: Machine instances list endpoint SHALL support singular id query parameter

The machine_instances list route SHALL accept both `id` (singular, single UUID) and `ids` (plural, comma-separated UUIDs) query parameters for filtering. When `id` is provided, the route SHALL filter to that single machine instance.

#### Scenario: Fetch single machine by singular id parameter
- **WHEN** a GET request is made to `/api/machine_instances/machines?id=<uuid>&pageSize=1`
- **THEN** the response SHALL contain exactly the machine instance with that id (if it exists in the tenant scope)

#### Scenario: Fetch multiple machines by plural ids parameter (existing behavior)
- **WHEN** a GET request is made to `/api/machine_instances/machines?ids=<uuid1>,<uuid2>`
- **THEN** the response SHALL contain exactly the machine instances matching those ids

#### Scenario: Both id and ids provided
- **WHEN** a GET request includes both `id` and `ids` parameters
- **THEN** the `ids` parameter SHALL take precedence (backwards-compatible)

### Requirement: MachineCascadeSelect SHALL hydrate selected machine on ticket edit

When editing an existing service ticket that has a `machine_instance_id`, the cascade select component SHALL load and display the machine's details (instance code, customer, site) by fetching the single machine via the API.

#### Scenario: Edit ticket with assigned machine
- **WHEN** a user opens the edit form for a ticket with `machine_instance_id: "<uuid>"`
- **THEN** the cascade select SHALL display the machine's instance code and auto-fill customer/address fields

#### Scenario: Edit ticket with no machine assigned
- **WHEN** a user opens the edit form for a ticket with `machine_instance_id: null`
- **THEN** the cascade select SHALL show the empty/placeholder state with no pre-selected machine
