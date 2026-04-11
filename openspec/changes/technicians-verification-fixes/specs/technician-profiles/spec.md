## MODIFIED Requirements

### Requirement: Technician CRUD API
The system SHALL expose a REST API at `/api/technicians` supporting list, create, update, and soft-delete operations. All operations SHALL require authentication and `technicians.view` / `technicians.create` / `technicians.edit` / `technicians.delete` permissions respectively. All queries SHALL filter by `tenantId` and `organizationId`.

#### Scenario: List active technicians
- **WHEN** a user requests `GET /api/technicians` with `is_active=true`
- **THEN** the system returns only active technician profiles

#### Scenario: Search technicians by skill
- **WHEN** a user requests `GET /api/technicians` with `skill=Electrical`
- **THEN** the system queries `technician_skills` for matching names and returns only technicians that have that skill

#### Scenario: Create technician with skills and certifications
- **WHEN** a user sends `POST /api/technicians` with profile data, skills array, and certifications array
- **THEN** the system creates the technician and all related skills and certifications in one operation
