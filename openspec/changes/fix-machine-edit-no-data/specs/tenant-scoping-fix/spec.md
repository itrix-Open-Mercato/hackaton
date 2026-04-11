## ADDED Requirements

### Requirement: Machine scope enforcement SHALL have regression coverage
The system SHALL include automated regression tests for the machine catalog and machine instances command handlers that were affected by the missing-scope bug. Those tests SHALL verify that update and delete operations succeed for records in the authenticated tenant and organization, and SHALL reject records outside that authenticated scope.

#### Scenario: Machine catalog regression tests cover in-scope and cross-scope mutations
- **WHEN** regression tests exercise profile and part-template update/delete handlers with authenticated tenant and organization context
- **THEN** the tests SHALL prove that matching-scope records are found and mutated, and mismatched-scope records return 404 without mutating data

#### Scenario: Machine instances regression tests cover in-scope and cross-scope mutations
- **WHEN** regression tests exercise machine instance update/delete handlers with authenticated tenant and organization context
- **THEN** the tests SHALL prove that matching-scope records are found and mutated, and mismatched-scope records return 404 without mutating data
