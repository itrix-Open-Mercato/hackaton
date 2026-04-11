## Why

Service tickets reference a company (`customerEntityId`) and a contact person (`contactPersonId`), but there is no server-side validation that the selected contact person actually belongs to the selected company. A coordinator can accidentally (or via API) submit a ticket with a mismatched person, leading to incorrect service records. Additionally, the ticket list table does not display the company name, forcing coordinators to open each ticket to see which customer it belongs to — slowing triage and dispatch workflows.

## What Changes

- **Server-side contact-person validation**: On ticket create and update, the API will verify that the submitted `contactPersonId` belongs to the submitted `customerEntityId` by querying the customers module. If the person does not belong to the company, the request is rejected with a validation error.
- **Contact person hot-reload on company change**: _(Already implemented)_ — `CustomerCascadeSelect` already clears the contact person and refetches people when company changes. No work needed.
- **Company column in ticket list table**: The `ServiceTicketsTable` will display a "Company" column showing the customer company name, fetched via response enrichment from the customers module.
- **Company filter on ticket list**: The ticket list table gains a company filter, allowing coordinators to filter tickets by customer company.

## Capabilities

### New Capabilities

- `ticket-company-contact-validation`: Server-side validation ensuring contact person belongs to the selected company on ticket create/update, plus client-side hot-reload of the contact person dropdown when company changes
- `ticket-list-company-display`: Display company name column and company filter in the service tickets list table

### Modified Capabilities

_None_ — These changes add new behavior on top of the existing service-tickets spec without altering existing requirements.

## Impact

- **API**: `POST /api/service_tickets/tickets` and `PUT /api/service_tickets/tickets/[id]` gain a new validation step that queries `/api/customers/companies/{id}?include=people` to verify contact person membership. New validation error response possible. List endpoint gains `customer_entity_id` filter parameter.
- **Backend UI**: `ServiceTicketsTable` gains a Company column and a company filter dropdown. Ticket form's contact person dropdown hot-reloads when company selection changes.
- **Dependencies**: Relies on the customers module API (`/api/customers/companies`) being available and returning people associations.
- **Performance**: One additional API call per ticket save (validation). Company names for list view should use response enrichment to avoid N+1 queries.
