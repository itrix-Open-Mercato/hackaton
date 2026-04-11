# Ticket Company-Contact Validation

## Requirements

### Requirement: Contact person must belong to selected company

The system SHALL validate on ticket create and update that the submitted `contactPersonId` is a person associated with the submitted `customerEntityId`. If the contact person does not belong to the company, the API SHALL reject the request with a validation error.

#### Scenario: Valid contact person for company
- **WHEN** coordinator submits a ticket with `customerEntityId` = company A and `contactPersonId` = person who belongs to company A
- **THEN** the ticket is created/updated successfully

#### Scenario: Invalid contact person for company
- **WHEN** coordinator submits a ticket with `customerEntityId` = company A and `contactPersonId` = person who does NOT belong to company A
- **THEN** the API returns a 422 validation error with a message indicating the contact person does not belong to the selected company
- **AND** the ticket is NOT created/updated

#### Scenario: Contact person without company
- **WHEN** coordinator submits a ticket with a `contactPersonId` but no `customerEntityId`
- **THEN** the API returns a 422 validation error (contact person requires a company)
- **AND** the ticket is NOT created/updated

#### Scenario: Company without contact person
- **WHEN** coordinator submits a ticket with a `customerEntityId` but no `contactPersonId`
- **THEN** the ticket is created/updated successfully (contact person is optional)

#### Scenario: Neither company nor contact person
- **WHEN** coordinator submits a ticket with neither `customerEntityId` nor `contactPersonId`
- **THEN** the ticket is created/updated successfully (both fields are optional)

#### Scenario: Update clears company but keeps contact person
- **WHEN** coordinator updates a ticket to remove the company (`customerEntityId` set to empty) while `contactPersonId` is still set
- **THEN** the backend clears the contact person as well (existing cascade behavior)
- **AND** no validation error occurs
