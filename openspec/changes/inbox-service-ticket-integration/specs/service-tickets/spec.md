## MODIFIED Requirements

### Requirement: Backend UI Pages

Three pages implemented:

| Page | Path | Auth |
|---|---|---|
| List | `/backend/service-tickets` | `service_tickets.view` |
| Create | `/backend/service-tickets/create` | `service_tickets.create` |
| Edit | `/backend/service-tickets/[id]/edit` | `service_tickets.edit` |

**Decision:** Edit page is a flat form (not a tabbed detail view). The original plan called for tabs (Overview, Technicians, Parts, History) but implementation went with a simpler single-page edit form. Parts and history are API-only for now.

The create page SHALL check for inbox prefill data on mount. When `fromInboxAction` query param is present and sessionStorage contains `inbox_ops.serviceTicketDraft`, the form SHALL:
1. Parse the JSON payload from sessionStorage
2. Merge non-empty fields into the form's initial values (service_type, priority, description, customer_entity_id, contact_person_id, machine_instance_id, address)
3. Display an info banner showing the source email subject with a link back to the proposal
4. Remove the sessionStorage key after reading (one-time use)
5. After successful save, mark the inbox action as executed if `fromInboxAction` param is present

#### Scenario: Create ticket
- **WHEN** coordinator submits the create form
- **THEN** a ticket is created with auto-generated ticket number (format `SRV-NNNNNN`, retry logic for race conditions)
- **AND** status defaults to `new`, priority defaults to `normal`
- **AND** staff assignments are created if technicians provided
- **AND** `service_tickets.ticket.created` event is emitted

#### Scenario: Create ticket from inbox prefill
- **WHEN** the create page loads with `fromInboxAction` query param and `inbox_ops.serviceTicketDraft` in sessionStorage
- **THEN** the form is pre-populated with fields from the payload (service_type, priority, description, customer, machine, address)
- **AND** an info banner reads "Pre-filled from email: {subject}" with a link to the proposal
- **AND** the sessionStorage key is removed
- **AND** the operator can review and modify all prefilled fields before saving

#### Scenario: Inbox prefill with missing sessionStorage
- **WHEN** the create page loads with `fromInboxAction` query param but no sessionStorage data
- **THEN** the form opens in normal empty state (no error, no banner)

#### Scenario: Post-save inbox action marking
- **WHEN** a ticket is successfully saved from the prefilled form
- **THEN** the originating inbox action is marked as executed with the new ticket ID
- **AND** if the marking request fails, a warning flash message is shown but the ticket save is preserved
