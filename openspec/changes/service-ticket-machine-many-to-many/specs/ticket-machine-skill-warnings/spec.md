## ADDED Requirements

### Requirement: Linked machines derive required skills and certifications
The system SHALL derive required skills and certifications for a service ticket from the machine catalog profiles of its linked machines. Derived requirements SHALL be stored in a queryable ticket-owned form and remain associated with the linked machine that produced them.

#### Scenario: Create derived requirements from linked machine profile
- **WHEN** a user links a machine whose catalog profile defines required skills or certifications
- **THEN** the system creates derived requirement records for that ticket and linked machine

#### Scenario: Multiple linked machines contribute requirements
- **WHEN** a ticket contains multiple linked machines with different required skills
- **THEN** the system persists requirements contributed by each linked machine for the same ticket

### Requirement: Ticket responses expose machine-derived requirements
The system SHALL expose derived skill and certification requirements in service ticket responses so backend forms and detail views can show why a ticket requires specific technician capabilities.

#### Scenario: Ticket detail shows derived requirements
- **WHEN** a client requests a service ticket that has machine-derived requirements
- **THEN** the response includes the requirement codes, types, and source linked machine context needed for display

#### Scenario: Ticket with no machine requirements returns an empty requirement list
- **WHEN** a service ticket has no linked-machine skill or certification requirements
- **THEN** the response returns an empty requirements collection

### Requirement: Technician mismatch is a warning, not a save blocker
The system SHALL compare assigned technicians with the ticket's derived requirements and surface mismatch warnings when a linked machine requires skills or certifications the assigned technicians do not satisfy. These warnings SHALL NOT block ticket create or update operations in this change.

#### Scenario: Warning shown for missing required skill
- **WHEN** a ticket includes a linked machine that requires a skill not present on the assigned technicians
- **THEN** the system returns a technician mismatch warning for the ticket

#### Scenario: Ticket still saves with mismatch warning
- **WHEN** a user saves a ticket that has technician mismatch warnings
- **THEN** the ticket is persisted successfully and the warnings remain visible in the response or UI state

### Requirement: Tickets can be filtered by derived requirement
The system SHALL allow ticket queries to filter by a required skill or certification code derived from linked machines.

#### Scenario: Filter tickets by required skill code
- **WHEN** a client requests service tickets filtered by a required skill code
- **THEN** the system returns tickets whose derived requirement set contains that skill code
