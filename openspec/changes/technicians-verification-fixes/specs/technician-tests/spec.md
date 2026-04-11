## ADDED Requirements

### Requirement: Validator unit tests
The system SHALL have unit tests for all Zod validation schemas in `data/validators.ts`. Tests SHALL verify valid inputs pass, invalid inputs are rejected, and edge cases (empty strings, missing fields, invalid UUIDs) are handled.

#### Scenario: Valid technician create input passes
- **WHEN** a valid technician create payload is validated
- **THEN** the schema returns parsed data without errors

#### Scenario: Invalid UUID is rejected
- **WHEN** a technician create payload has an invalid staff_member_id
- **THEN** the schema throws a validation error

### Requirement: Command unit tests
The system SHALL have unit tests for technician CRUD commands in `commands/technicians.ts`. Tests SHALL verify create (including duplicate prevention), update, and delete operations using mocked dependencies.

#### Scenario: Create command prevents duplicate profiles
- **WHEN** a create command is executed for a staffMemberId that already has a profile
- **THEN** the command throws a 409 CrudHttpError

#### Scenario: Update command modifies fields
- **WHEN** an update command is executed with isActive=false
- **THEN** the technician entity is updated

### Requirement: API integration tests
The system SHALL have integration tests (Playwright or API-level) that verify the technicians API endpoints work end-to-end. Tests SHALL cover: list (with filters), create, update, delete, skill add/remove, and certification add/remove.

#### Scenario: Full CRUD lifecycle test
- **WHEN** the test creates a technician, adds skills, adds certifications, updates the profile, and deletes it
- **THEN** each API call returns the expected status code and response shape

#### Scenario: Skill filter returns matching technicians
- **WHEN** the test creates technicians with different skills and queries with skill filter
- **THEN** only technicians with the matching skill are returned
