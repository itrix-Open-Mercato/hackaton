## ADDED Requirements

### Requirement: Response enricher for technician data on tickets
The `technicians` module SHALL provide a response enricher targeting `service_tickets:service_ticket`. For each ticket in a list/detail response, the enricher SHALL resolve `ServiceTicketAssignment` records, look up matching `Technician` profiles by `staffMemberId`, and attach technician IDs and skill lists under a `_technicians` namespace.

#### Scenario: Ticket with assigned technicians is enriched
- **WHEN** a service ticket response includes assignments with staffMemberIds that have technician profiles
- **THEN** the response includes `_technicians.assignments` with technician IDs and skills

#### Scenario: Ticket with no assignments returns empty enrichment
- **WHEN** a service ticket response has no assignments
- **THEN** the response includes `_technicians.assignments` as an empty array

## MODIFIED Requirements

### Requirement: Technician picker widget on service ticket form
The `technicians` module SHALL inject a multi-select picker widget into the service ticket create/edit form. The picker SHALL display active technicians with their staff member ID and skills. Selected technician IDs SHALL be written to the form's `staff_member_ids` field.

#### Scenario: Picker shows active technicians
- **WHEN** a user opens the service ticket create or edit form
- **THEN** the technician picker displays all active technicians with their staff member ID and skill tags

#### Scenario: Picker filters by search
- **WHEN** a user types a search term in the technician picker
- **THEN** the picker filters technicians by skill match (client-side)

#### Scenario: Selected technicians persist on form save
- **WHEN** a user selects technicians in the picker and saves the ticket
- **THEN** the selected technician `staffMemberId` values are sent as `staff_member_ids` in the ticket payload
