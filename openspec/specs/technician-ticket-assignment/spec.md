# Capability: Technician–Ticket Assignment

## Purpose

Integration between the technicians module and service tickets — picker widget for assigning technicians and response enrichment for displaying technician names.

## Requirements

### Requirement: Technician picker widget on service ticket form
The `technicians` module SHALL inject a multi-select picker widget into the service ticket create/edit form. The picker SHALL display active technicians with their name and skills. Selected technician IDs SHALL be written to the form's `staff_member_ids` field.

#### Scenario: Picker shows active technicians
- **WHEN** a user opens the service ticket create or edit form
- **THEN** the technician picker displays all active technicians with their names and skill tags

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
