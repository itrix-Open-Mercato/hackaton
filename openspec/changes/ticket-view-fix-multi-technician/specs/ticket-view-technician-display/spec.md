## ADDED Requirements

### Requirement: Assigned technician details displayed on ticket edit view

When viewing or editing a service ticket, the assigned technicians SHALL be displayed with their full profile information (name, skills, certifications) instead of raw staff member UUIDs.

#### Scenario: Ticket with assigned technicians shows their details

- **WHEN** a coordinator opens the edit page for a ticket that has assigned technicians
- **THEN** each assigned technician's display name SHALL be shown
- **AND** each assigned technician's skills SHALL be shown as tags
- **AND** each assigned technician's certifications SHALL be shown

#### Scenario: Ticket with no assigned technicians shows empty state

- **WHEN** a coordinator opens the edit page for a ticket with no staff assignments
- **THEN** the technician section SHALL show an empty state or placeholder indicating no technicians are assigned

#### Scenario: Technician details fetched via API calls

- **WHEN** the ticket edit page resolves assigned technician details
- **THEN** it SHALL use API calls to `/api/technicians/technicians` to fetch technician data
- **AND** it SHALL NOT import technician entities directly (Turbopack cross-module constraint)
