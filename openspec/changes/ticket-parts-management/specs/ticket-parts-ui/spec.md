## ADDED Requirements

### Requirement: Parts list on ticket edit page

The system SHALL display a parts management section below the ticket form on the edit page, showing all parts currently attached to the ticket.

Each row SHALL display: part name (resolved from catalog template), quantity, notes, and action buttons (edit, delete).

The section SHALL load parts by calling `GET /api/service_tickets/parts?ticket_id={id}` on mount.

#### Scenario: Ticket has parts
- **WHEN** the edit page loads for a ticket that has parts
- **THEN** a "Parts" section appears below the ticket form
- **AND** each part is shown as a row with name, quantity, notes, and action buttons

#### Scenario: Ticket has no parts
- **WHEN** the edit page loads for a ticket with no parts
- **THEN** the "Parts" section appears with an empty state message

#### Scenario: Parts list refreshes after mutation
- **WHEN** a part is added, updated, or deleted
- **THEN** the parts list re-fetches from the API and re-renders

---

### Requirement: One-click add from recommended parts

The system SHALL display an "add to ticket" button next to each recommended part in the machine hints panel, but only for templates that have a `partCatalogProductId`.

Clicking the button SHALL create a `ServiceTicketPart` with `product_id` set to the template's `partCatalogProductId`, `quantity` pre-filled from `quantityDefault` (defaulting to 1), and the parts list SHALL refresh.

#### Scenario: Add recommended part to ticket
- **WHEN** user clicks the "+" button on a recommended part that has a `partCatalogProductId`
- **THEN** the system calls `POST /api/service_tickets/parts` with `ticket_id`, `product_id` (from template's `partCatalogProductId`), and `quantity` (from template's `quantityDefault`, or 1 if null)
- **AND** the parts list section refreshes to show the newly added part

#### Scenario: Recommended part without catalog product ID
- **WHEN** a recommended part template has no `partCatalogProductId`
- **THEN** no "add to ticket" button is shown for that template

#### Scenario: Duplicate add attempt
- **WHEN** user clicks "+" on a recommended part that is already in the ticket parts list (same `product_id`)
- **THEN** the system SHALL still create the part (duplicates are allowed — same product may be needed in different quantities or with different notes)

---

### Requirement: Inline part editing

The system SHALL allow editing quantity and notes on an existing ticket part inline, without navigating away from the page.

#### Scenario: Edit part quantity
- **WHEN** user clicks the edit button on a part row
- **THEN** quantity and notes fields become editable inline
- **AND** a save button appears

#### Scenario: Save part edits
- **WHEN** user modifies quantity or notes and clicks save
- **THEN** the system calls `PUT /api/service_tickets/parts` with `id`, updated `quantity`, and updated `notes`
- **AND** the row returns to display mode with updated values

#### Scenario: Cancel part edit
- **WHEN** user presses Escape while editing a part
- **THEN** the row reverts to display mode without saving

---

### Requirement: Delete part from ticket

The system SHALL allow removing a part from the ticket.

#### Scenario: Delete part
- **WHEN** user clicks the delete button on a part row
- **THEN** the system calls `DELETE /api/service_tickets/parts?id={partId}`
- **AND** the part disappears from the list

---

### Requirement: Part name resolution

The system SHALL resolve `product_id` UUIDs to human-readable part names using the machine catalog part templates data.

#### Scenario: Part added from recommendation
- **WHEN** a part was added from a recommended template
- **THEN** the part name, part code, and quantity unit are displayed from the cached template data

#### Scenario: Part with unresolvable product ID
- **WHEN** a part's `product_id` cannot be matched to any known template
- **THEN** the system SHALL display a truncated UUID as fallback (first 8 characters)
