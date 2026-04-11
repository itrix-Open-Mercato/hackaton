## ADDED Requirements

### Requirement: Multi-select technician picker on service ticket form

The technicians module SHALL inject a multi-select picker widget into the service ticket create and edit forms. The picker SHALL display active technicians with their display name, skills (as tags), and certifications. Selected technician IDs SHALL be written to the form's `staff_member_ids` field.

#### Scenario: Picker displays active technicians with skills and certifications

- **WHEN** a coordinator opens the service ticket create or edit form
- **THEN** the technician picker SHALL display all active technicians for the current organization
- **AND** each technician entry SHALL show the technician's display name
- **AND** each technician entry SHALL show the technician's skills as tags
- **AND** each technician entry SHALL show the technician's certifications

#### Scenario: Picker supports multi-select

- **WHEN** a coordinator selects multiple technicians in the picker
- **THEN** all selected technicians SHALL be visually indicated as selected
- **AND** the picker SHALL write all selected technician `staffMemberId` values to the form's `staff_member_ids` field

#### Scenario: Picker filters by search term

- **WHEN** a coordinator types a search term in the technician picker
- **THEN** the picker SHALL filter technicians by name or skill match

#### Scenario: Selected technicians persist on form save

- **WHEN** a coordinator selects technicians in the picker and saves the ticket
- **THEN** the selected technician `staffMemberId` values SHALL be sent as `staff_member_ids` in the ticket create/update payload
- **AND** `ServiceTicketAssignment` records SHALL be created or updated accordingly

#### Scenario: Picker pre-selects currently assigned technicians on edit

- **WHEN** a coordinator opens the edit form for a ticket that already has assigned technicians
- **THEN** the picker SHALL pre-select the currently assigned technicians

#### Scenario: Picker invalidates cache on organization switch

- **WHEN** the organization context changes (user switches org)
- **THEN** the picker SHALL fetch a fresh technician list for the new organization
- **AND** previously cached technician data from the old organization SHALL NOT be shown
