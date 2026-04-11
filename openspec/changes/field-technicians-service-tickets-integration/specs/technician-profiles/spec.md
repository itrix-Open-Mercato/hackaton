## ADDED Requirements

### Requirement: Technician entity linked to staff member
The system SHALL maintain a `Technician` entity that links to an existing staff member via `staffMemberId` (UUID). Each technician SHALL have an `isActive` boolean flag (default `true`) and an optional `notes` text field. A staff member SHALL have at most one technician profile.

#### Scenario: Create technician profile for a staff member
- **WHEN** a user creates a technician with a valid `staffMemberId`
- **THEN** the system creates a `Technician` record linked to that staff member with `isActive = true`

#### Scenario: Prevent duplicate technician profiles
- **WHEN** a user attempts to create a technician for a `staffMemberId` that already has a profile
- **THEN** the system returns a 409 conflict error

#### Scenario: Deactivate a technician
- **WHEN** a user updates a technician setting `isActive` to `false`
- **THEN** the technician is excluded from active technician queries

### Requirement: Technician skills as free-form tags
The system SHALL store skills as `TechnicianSkill` entities linked to a technician. Each skill SHALL have a `name` (text). Skill names SHALL be unique per technician.

#### Scenario: Add skill to technician
- **WHEN** a user adds a skill with name "Electrical" to a technician
- **THEN** a `TechnicianSkill` record is created linked to that technician

#### Scenario: Prevent duplicate skills on same technician
- **WHEN** a user adds a skill with a name that already exists on the same technician
- **THEN** the system returns a validation error

#### Scenario: Remove skill from technician
- **WHEN** a user removes a skill from a technician
- **THEN** the `TechnicianSkill` record is deleted

### Requirement: Technician certifications with expiry
The system SHALL store certifications as `TechnicianCertification` entities linked to a technician. Each certification SHALL have `name` (required), `certificateNumber` (optional), `issuedAt` (optional date), and `expiresAt` (optional date).

#### Scenario: Add certification to technician
- **WHEN** a user adds a certification with name "ISO 9001" and expiry date
- **THEN** a `TechnicianCertification` record is created

#### Scenario: List certifications showing expiry status
- **WHEN** a certification's `expiresAt` date is in the past
- **THEN** the certification is flagged as expired in the response

### Requirement: Technician CRUD API
The system SHALL expose a REST API at `/api/technicians` supporting list, create, update, and soft-delete operations. All operations SHALL require authentication and `technicians.view` / `technicians.create` / `technicians.edit` / `technicians.delete` permissions respectively. All queries SHALL filter by `tenantId` and `organizationId`.

#### Scenario: List active technicians
- **WHEN** a user requests `GET /api/technicians` with `is_active=true`
- **THEN** the system returns only active technician profiles

#### Scenario: Search technicians by skill
- **WHEN** a user requests `GET /api/technicians` with `skill=Electrical`
- **THEN** the system returns technicians that have the "Electrical" skill

#### Scenario: Create technician with skills and certifications
- **WHEN** a user sends `POST /api/technicians` with profile data, skills array, and certifications array
- **THEN** the system creates the technician and all related skills and certifications in one operation

### Requirement: Module registration and permissions
The `technicians` module SHALL be registered in `src/modules.ts` as `{ id: 'technicians', from: '@app' }`. It SHALL define ACL features: `technicians.view`, `technicians.create`, `technicians.edit`, `technicians.delete`. Default role features SHALL grant all permissions to superadmin and admin, and view+create+edit to employee.

#### Scenario: Module is discovered by framework
- **WHEN** the application starts
- **THEN** the `technicians` module is loaded and its API routes are available

#### Scenario: Unauthorized access denied
- **WHEN** a user without `technicians.view` permission requests `GET /api/technicians`
- **THEN** the system returns a 403 forbidden error
