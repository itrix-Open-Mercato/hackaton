## ADDED Requirements

### Requirement: SessionStorage prefill handoff

When the operator clicks "Open Ticket Form" on a `create_service_ticket` proposal action, the system SHALL write the action payload to sessionStorage and navigate to the ticket create page.

The sessionStorage key SHALL be `inbox_ops.serviceTicketDraft`.

The stored JSON SHALL include:
- `actionId` — the inbox action ID
- `proposalId` — the parent proposal ID
- `payload` — the full normalized action payload (including resolved IDs and metadata)

The navigation target SHALL be `/backend/service-tickets/create?fromInboxAction={actionId}`.

#### Scenario: Click "Open Ticket Form"
- **WHEN** operator clicks the action button on a `create_service_ticket` proposal action
- **THEN** sessionStorage key `inbox_ops.serviceTicketDraft` is set with action metadata and payload
- **AND** browser navigates to `/backend/service-tickets/create?fromInboxAction={actionId}`

#### Scenario: SessionStorage unavailable
- **WHEN** sessionStorage is unavailable (e.g., private browsing restrictions)
- **THEN** the error is silently caught
- **AND** navigation still proceeds (form opens without prefill)

---

### Requirement: Action button via widget injection

The `service_tickets` module SHALL inject an "Open Ticket Form" button into the inbox proposal detail page's action card area for actions of type `create_service_ticket`.

The widget SHALL be registered in `src/modules/service_tickets/widgets/injection-table.ts` targeting the inbox proposal action card slot.

#### Scenario: Button visible for create_service_ticket actions
- **WHEN** operator views a proposal containing a `create_service_ticket` action
- **THEN** an "Open Ticket Form" button appears on that action's card

#### Scenario: Button not visible for other action types
- **WHEN** operator views a proposal containing a `create_order` action
- **THEN** no "Open Ticket Form" button appears (only the standard sales action buttons)

---

### Requirement: Discrepancy display in proposal UI

The proposal action card for `create_service_ticket` SHALL surface matching discrepancies from the `_discrepancies` payload field.

Discrepancy types:
- `unknown_contact` — sender email not matched to any customer
- `ambiguous_customer` — sender domain matched multiple customers
- `machine_not_found` — machine hints did not resolve to a customer machine

#### Scenario: Unknown sender discrepancy
- **WHEN** the action payload contains `_discrepancies: [{type: "unknown_contact", ...}]`
- **THEN** the action card displays a warning: sender not recognized as a known customer

#### Scenario: Ambiguous customer discrepancy
- **WHEN** the action payload contains `_discrepancies: [{type: "ambiguous_customer", ...}]`
- **THEN** the action card displays a warning listing the candidate customer names

#### Scenario: Machine not found discrepancy
- **WHEN** the action payload contains `_discrepancies: [{type: "machine_not_found", ...}]`
- **THEN** the action card displays a warning that the referenced machine could not be matched

#### Scenario: No discrepancies
- **WHEN** the action payload has an empty `_discrepancies` array
- **THEN** no warning indicators are shown on the action card

---

### Requirement: Post-save action execution marking

After the ticket is successfully created from the prefilled form, the system SHALL mark the originating inbox action as executed.

The marking call SHALL include the created ticket ID and entity type (`service_ticket`).

#### Scenario: Successful ticket save marks action
- **WHEN** a ticket is saved from the prefilled create form (detected via `fromInboxAction` query param)
- **THEN** a PATCH request updates the inbox action status to `executed`
- **AND** the request body includes `createdEntityId` (the new ticket ID) and `createdEntityType: "service_ticket"`

#### Scenario: Action marking failure is non-blocking
- **WHEN** the PATCH request to mark the action fails (network error, etc.)
- **THEN** the ticket creation is NOT rolled back
- **AND** the user sees a warning that the inbox action could not be updated
- **AND** the ticket remains saved

#### Scenario: No fromInboxAction param
- **WHEN** a ticket is created without the `fromInboxAction` query param
- **THEN** no inbox action marking is attempted (normal create flow)
