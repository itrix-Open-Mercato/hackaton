## MODIFIED Requirements

### Requirement: Technician entity linked to staff member
The system SHALL maintain a `Technician` entity with an optional link to a staff member via `staffMemberId` (UUID, nullable). Each technician SHALL have an `isActive` boolean flag (default `true`) and an optional `notes` text field. When `staffMemberId` is provided, the system SHOULD warn (not reject) if the same staff member already has a technician profile.

#### Scenario: Create technician profile for a staff member
- **WHEN** a user creates a technician with a valid `staffMemberId`
- **THEN** the system creates a `Technician` record linked to that staff member with `isActive = true`

#### Scenario: Create technician without staff member link
- **WHEN** a user creates a technician without `staffMemberId`
- **THEN** the system creates a `Technician` record with `staffMemberId = null`

#### Scenario: Warn on duplicate staff member link
- **WHEN** a user creates a technician for a `staffMemberId` that already has a profile
- **THEN** the system creates the record but MAY log a warning (no hard reject)

#### Scenario: Deactivate a technician
- **WHEN** a user updates a technician setting `isActive` to `false`
- **THEN** the technician is excluded from active technician queries

### Requirement: Technician skills as free-form tags
The system SHALL store skills in two forms: (1) `TechnicianSkill` entities linked to a technician, each with a `name` (text, unique per technician), and (2) a denormalized `skills` JSONB string array column on the `technicians` table (default `[]`). Skill add/remove operations SHALL update both stores. Skills SHALL be normalized to lowercase on write.

#### Scenario: Add skill to technician
- **WHEN** a user adds a skill with name "Electrical" to a technician
- **THEN** a `TechnicianSkill` record is created AND the `skills` JSONB array on the technician is updated to include `"electrical"`

#### Scenario: Prevent duplicate skills on same technician
- **WHEN** a user adds a skill with a name that already exists on the same technician
- **THEN** the system returns a validation error

#### Scenario: Remove skill from technician
- **WHEN** a user removes a skill from a technician
- **THEN** the `TechnicianSkill` record is deleted AND the `skills` JSONB array is updated to remove the entry

#### Scenario: Create technician with skills array
- **WHEN** a user creates a technician with `skills: ['CNC', 'Laser']`
- **THEN** `TechnicianSkill` records are created for each AND the `skills` JSONB array is set to `['cnc', 'laser']`

### Requirement: Technician CRUD API
The system SHALL expose a REST API at `/api/technicians` supporting list, create, update, and soft-delete operations. All operations SHALL require authentication and appropriate `technicians.*` permissions. All queries SHALL filter by `tenantId` and `organizationId`. The create and update schemas SHALL accept all new fields (firstName, lastName, email, phone, locationStatus, languages, vehicleId, vehicleLabel, currentOrderId, skills).

#### Scenario: List active technicians
- **WHEN** a user requests `GET /api/technicians` with `is_active=true`
- **THEN** the system returns only active technician profiles with all fields including new dispatch fields

#### Scenario: Search technicians by skill
- **WHEN** a user requests `GET /api/technicians` with `skill=Electrical`
- **THEN** the system returns technicians that have the "Electrical" skill

#### Scenario: Create technician with skills and certifications
- **WHEN** a user sends `POST /api/technicians` with profile data, skills array, and certifications array
- **THEN** the system creates the technician and all related skills and certifications in one operation

#### Scenario: Update technician with new dispatch fields
- **WHEN** a user sends `PUT /api/technicians` with `locationStatus`, `firstName`, `email`, and `languages`
- **THEN** the system updates all provided fields on the technician record
