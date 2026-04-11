## ADDED Requirements

### Requirement: Linked machines store historical service context
The system SHALL snapshot key machine context on each `ServiceTicketMachine` record so ticket history remains readable even if upstream machine or catalog data changes later. Snapshot fields SHALL include machine identifiers and the display fields needed by ticket forms, lists, and detail views.

#### Scenario: Machine snapshot stored on ticket link
- **WHEN** a user links a machine instance to a service ticket
- **THEN** the system stores machine display snapshot fields on the `ServiceTicketMachine` record alongside the foreign-key identifier

#### Scenario: Ticket still shows machine context after source data changes
- **WHEN** upstream machine display data changes after a ticket was saved
- **THEN** the ticket continues to expose the snapshot values captured on its linked machine records

### Requirement: Proposed parts belong to a linked machine
The system SHALL store planned spare parts as `ServiceTicketMachinePart` records linked to a specific `ServiceTicketMachine`. Each planned part SHALL include its proposed quantity, part name snapshot, optional catalog product reference, optional template reference, optional service context, and sort order. A planned part SHALL NOT exist without a linked machine.

#### Scenario: Add manual proposed part to one linked machine
- **WHEN** a user adds a manual planned part to one machine on a ticket
- **THEN** the system stores that part under the corresponding `ServiceTicketMachine` and does not attach it to other linked machines

#### Scenario: Reject orphan machine part
- **WHEN** a request attempts to create a planned part without a valid linked machine reference
- **THEN** the system rejects the request with a validation error

### Requirement: Planned part templates load idempotently from machine catalog context
The system SHALL support importing suggested planned parts for a linked machine from machine catalog part templates resolved through the machine's catalog profile. Re-importing the same template for the same linked machine SHALL NOT create duplicate planned part rows.

#### Scenario: Import suggested parts from catalog profile
- **WHEN** a linked machine resolves to a machine catalog profile that has part templates
- **THEN** the system can create planned machine-part rows from those templates for that linked machine

#### Scenario: Re-import does not duplicate template-based parts
- **WHEN** suggested parts are imported again for the same linked machine and template set
- **THEN** the system preserves one active planned part row per linked machine and template pair

### Requirement: Linked machines expose documentation shortcuts
The system SHALL expose documentation shortcuts for each linked machine based on the resolved machine catalog context. Ticket responses SHALL include the documentation references that are available for that machine type without requiring the client to reconstruct the catalog lookup itself.

#### Scenario: Linked machine includes catalog documentation references
- **WHEN** a linked machine resolves to catalog-backed documentation
- **THEN** the ticket response includes documentation shortcut metadata for that linked machine

#### Scenario: Missing documentation returns an empty machine-specific list
- **WHEN** a linked machine has no documentation references in its catalog context
- **THEN** the ticket response returns an empty documentation collection for that linked machine

