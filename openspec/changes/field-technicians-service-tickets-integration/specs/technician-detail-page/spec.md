## ADDED Requirements

### Requirement: Technician list page
The system SHALL provide a backend admin page at `/backend/technicians` showing a paginated table of all technicians. The table SHALL display: staff member name, active status, skill count, and certification count. The table SHALL support search by name and filtering by active status.

#### Scenario: List page shows all technicians
- **WHEN** a user navigates to `/backend/technicians`
- **THEN** the system displays a paginated table of technicians with columns for name, status, skills count, and certifications count

#### Scenario: Filter by active status
- **WHEN** a user filters the technician list by "Active only"
- **THEN** only technicians with `isActive = true` are displayed

### Requirement: Technician create page
The system SHALL provide a backend page at `/backend/technicians/create` with a form to create a new technician. The form SHALL include: staff member selector, active status toggle, notes field, skills input (tag-style), and certifications section.

#### Scenario: Create technician with skills
- **WHEN** a user fills in the create form with a staff member, skills ["Electrical", "HVAC"], and submits
- **THEN** a technician profile is created with the two skills attached

### Requirement: Technician edit/detail page (Karta Serwisanta)
The system SHALL provide a backend page at `/backend/technicians/[id]/edit` showing the full technician profile. The page SHALL display: staff member info, active status, notes, skills (editable), certifications (editable), and a read-only section showing recent ticket assignments for this technician.

#### Scenario: Edit technician profile
- **WHEN** a user edits a technician's skills and saves
- **THEN** the skills are updated (added/removed as needed)

#### Scenario: View ticket assignment history
- **WHEN** a user views a technician detail page
- **THEN** the page shows recent service tickets assigned to this technician (via `ServiceTicketAssignment` where `staffMemberId` matches)

### Requirement: Sidebar navigation
The `technicians` module SHALL inject a sidebar menu item under the service management section. The menu item SHALL link to `/backend/technicians` and use a `lucide-react` icon.

#### Scenario: Sidebar shows technicians link
- **WHEN** a user with `technicians.view` permission opens the admin sidebar
- **THEN** a "Technicians" menu item is visible linking to the technician list
