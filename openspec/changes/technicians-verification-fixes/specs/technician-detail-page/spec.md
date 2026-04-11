## MODIFIED Requirements

### Requirement: Technician create page
The system SHALL provide a backend page at `/backend/technicians/create` with a form to create a new technician. After successful creation, the system SHALL redirect to the edit page where skills and certifications can be managed.

#### Scenario: Create technician and redirect to edit
- **WHEN** a user fills in the create form with a staff member ID and submits
- **THEN** a technician profile is created and the user is redirected to the edit page for that technician

### Requirement: Technician edit/detail page (Karta Serwisanta)
The system SHALL provide a backend page at `/backend/technicians/[id]/edit` showing the full technician profile. The page SHALL display: staff member info, active status, notes, skills (editable), certifications (editable), and a read-only section showing recent ticket assignments for this technician filtered by their staffMemberId.

#### Scenario: Edit technician profile
- **WHEN** a user edits a technician's skills and saves
- **THEN** the skills are updated (added/removed as needed)

#### Scenario: View ticket assignment history
- **WHEN** a user views a technician detail page
- **THEN** the page shows only service tickets assigned to this specific technician (filtered by staffMemberId via ServiceTicketAssignment)
