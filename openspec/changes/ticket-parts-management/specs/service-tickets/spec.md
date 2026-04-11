## MODIFIED Requirements

### Requirement: Backend UI Pages

Three pages implemented:

| Page | Path | Auth |
|---|---|---|
| List | `/backend/service-tickets` | `service_tickets.view` |
| Create | `/backend/service-tickets/create` | `service_tickets.create` |
| Edit | `/backend/service-tickets/[id]/edit` | `service_tickets.edit` |

The edit page SHALL include a parts management section below the ticket form. Parts are managed independently from the ticket form — each add/edit/delete operation saves immediately via the parts API.

The create page does not include a parts section (parts require an existing `ticket_id`).

The service type dropdown on both create and edit pages SHALL be filtered by the selected machine's supported service types when a machine is selected.

**Decision:** Edit page is a flat form with a parts section below. The original plan called for tabs (Overview, Technicians, Parts, History) but implementation uses a single-page layout. Parts are now visible and manageable on the edit page.

#### Scenario: Edit page displays parts section
- **WHEN** user navigates to the ticket edit page
- **THEN** the ticket form is shown at the top
- **AND** a parts management section is shown below the form
- **AND** parts load independently from the ticket data

#### Scenario: Service type dropdown respects machine on edit page
- **WHEN** user edits a ticket with a machine selected
- **THEN** the service type dropdown is filtered to the machine's supported service types

#### Scenario: Service type dropdown respects machine on create page
- **WHEN** user selects a machine on the create page
- **THEN** the service type dropdown is filtered to the machine's supported service types
