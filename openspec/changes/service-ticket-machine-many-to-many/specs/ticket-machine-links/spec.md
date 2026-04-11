## ADDED Requirements

### Requirement: Service tickets support multiple linked machines
The system SHALL allow a service ticket to persist multiple linked machine instances through `ServiceTicketMachine` records owned by the `service_tickets` module. Each link SHALL store the referenced `machineInstanceId`, tenant and organization scope, `sortOrder`, and whether the link is marked as primary. The system SHALL reject duplicate active links to the same `machineInstanceId` within one ticket.

#### Scenario: Create ticket with multiple linked machines
- **WHEN** a user creates or updates a service ticket with two different `machineInstanceId` values
- **THEN** the system stores two `ServiceTicketMachine` records linked to that ticket in the provided order

#### Scenario: Reject duplicate machine on the same ticket
- **WHEN** a user submits a ticket payload containing the same `machineInstanceId` more than once
- **THEN** the system rejects the request with a validation error and does not partially persist linked machines

### Requirement: Linked machines are tenant-scoped and customer-aware
The system SHALL only accept linked machines that belong to the same tenant and organization as the service ticket. When a linked machine has customer ownership data, the system SHALL validate that the machine belongs to the ticket customer unless an explicit override flow is later specified.

#### Scenario: Reject machine from another organization
- **WHEN** a user submits a linked `machineInstanceId` that belongs to a different organization than the ticket
- **THEN** the system rejects the request with a validation error

#### Scenario: Reject cross-customer machine by default
- **WHEN** a user links a machine whose customer ownership does not match the ticket customer
- **THEN** the system rejects the request until a cross-customer override flow is defined

### Requirement: Service tickets expose a collection-based machine API
The system SHALL expose linked machines through a `machineInstances` collection in service ticket create, update, list, and detail responses. Each collection item SHALL include the ticket-machine link identifier, `machineInstanceId`, `isPrimary`, `sortOrder`, and display snapshot fields needed by backend ticket views. The legacy top-level `machineInstanceId` field SHALL NOT be part of the ticket API contract for this change.

#### Scenario: Ticket detail returns linked machine collection
- **WHEN** a client requests a service ticket that has linked machines
- **THEN** the response contains a `machineInstances` array with one item per active ticket-machine link

#### Scenario: Primary machine is represented inside the collection
- **WHEN** one linked machine is marked as primary
- **THEN** the response marks that machine with `isPrimary = true` and does not return a separate top-level primary machine field

### Requirement: Tickets can be filtered by linked machine instance
The system SHALL allow ticket queries to return service tickets associated with a given `machineInstanceId` based on active `ServiceTicketMachine` records.

#### Scenario: Filter tickets by machine instance
- **WHEN** a client requests service tickets with a machine filter for a specific `machineInstanceId`
- **THEN** the system returns tickets that contain an active linked machine with that identifier

