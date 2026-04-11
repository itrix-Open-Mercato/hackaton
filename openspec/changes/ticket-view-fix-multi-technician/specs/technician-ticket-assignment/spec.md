## MODIFIED Requirements

### Requirement: Technician picker widget on service ticket form

The `technicians` module SHALL inject a multi-select picker widget into the service ticket create/edit form. The picker SHALL display active technicians with their name, skills, and certifications. Selected technician IDs SHALL be written to the form's `staff_member_ids` field.

#### Scenario: Picker shows active technicians with skills and certifications

- **WHEN** a user opens the service ticket create or edit form
- **THEN** the technician picker displays all active technicians with their names, skill tags, and certifications

#### Scenario: Picker filters by search

- **WHEN** a user types a search term in the technician picker
- **THEN** the picker filters technicians by name or skill match

#### Scenario: Selected technicians persist on form save

- **WHEN** a user selects technicians in the picker and saves the ticket
- **THEN** the selected technician `staffMemberId` values are sent as `staff_member_ids` in the ticket payload

### Requirement: Technician names displayed on ticket list and detail

The `technicians` module SHALL enrich service ticket responses with assigned technician display names. When a ticket has `ServiceTicketAssignment` records, the enricher SHALL resolve the staff member IDs to technician profile names.

#### Scenario: Ticket detail shows assigned technician names

- **WHEN** a user views a service ticket that has assigned technicians
- **THEN** the ticket detail displays technician names instead of raw UUIDs

#### Scenario: Ticket with no assignments shows empty

- **WHEN** a user views a service ticket with no staff assignments
- **THEN** the technician section shows an empty state

## ADDED Requirements

### Requirement: Technician picker SHALL display certifications

In addition to skills, the technician picker widget SHALL display each technician's certifications to help coordinators assign qualified personnel.

#### Scenario: Picker shows certification names and expiry

- **WHEN** a coordinator views the technician picker
- **THEN** each technician entry SHALL show their certification names
- **AND** expired certifications SHALL be visually distinguishable from active ones

### Requirement: Technician picker SHALL invalidate on organization change

The picker's React Query cache SHALL include organization scope so that switching organizations fetches fresh data.

#### Scenario: Organization switch refreshes picker data

- **WHEN** a user switches their active organization while the ticket form is open
- **THEN** the technician picker SHALL discard cached data from the previous organization
- **AND** the picker SHALL fetch and display technicians from the new organization
