# Service Tickets Product Spec

**Date:** 2026-04-11  
**Source inputs:**  
- `.ai/specs/2026-04-10-service-management-system.md`  
- `.ai/plans/p1-service-tickets-implementation.md`  
- `.ai/plans/p1-service-tickets-improvements.md`

## TLDR

This spec describes the `service_tickets` module for the field-service hackathon scope in a format suitable for product review.

The module gives coordinators a single place to register service requests, assign technicians, schedule visits, track linked customer machines, and maintain a basic service history. It is the operational center of the wider service-management solution and integrates with customer, machine, technician, and schedule data.

The planned delivery is split into:
- **MVP**: ticket CRUD, statuses, priorities, technician assignment, planned visit date, parts list, and date-change history
- **Usability improvements**: working table filters, company autocomplete, and contact-person selection dependent on the selected company

## Overview

The business needs a lightweight service-workflow module that allows a service coordinator to move from an incoming request to a planned visit without switching between spreadsheets, email, and separate internal tools.

Within the broader service-management solution, `service_tickets` is the central operational module:
- It links a customer to a specific installed machine
- It stores the service request and visit details
- It lets the dispatcher assign one or more technicians
- It provides the signal used by the schedule module to create technician reservations

This specification is intentionally product-facing. It focuses on workflow, scope, outcomes, and acceptance criteria rather than detailed implementation instructions.

## Problem Statement

Today the platform does not offer a dedicated workflow for field-service cases. Existing modules cover only fragments of the process:
- `customers` stores client records
- `catalog` stores machine types and product definitions
- `staff` stores team-member data
- `planner` supports availability rules but not actual service bookings

As a result, service teams lack a single operational record that answers:
- What was reported?
- Which customer and machine are affected?
- Who is assigned?
- When is the visit planned?
- What changed over time?
- Which parts may be needed?

## Proposed Solution

Introduce a `service_tickets` module that acts as the central work-order record for field service.

Each ticket should support:
- Basic classification by service type, priority, and status
- Free-text issue description
- Planned visit date and visit end date
- Customer and machine linkage
- Technician assignment
- Parts list
- Date-change history for rescheduling traceability

When a ticket is created or updated with technicians and visit timing, the wider service-management solution can use that information to generate or update technician reservations in the service schedule module.

## Product Goals

- Reduce time needed to register and schedule a service case
- Give dispatchers one clear operational record per case
- Improve planning quality by linking tickets with technicians and visit dates
- Improve data quality by replacing pasted UUID workflows with searchable selections
- Create a foundation for future service processes such as protocols, costs, SLA tracking, and automation

## Users

- **Service coordinator / dispatcher**: creates and updates tickets, assigns technicians, changes dates, tracks progress
- **Service manager**: reviews workload, priorities, and operational status
- **Technician**: indirectly benefits from clearer assignment and scheduling data

## Scope

### In Scope for MVP

- Create, view, update, and soft-delete service tickets
- Track ticket number, service type, priority, status, description, address, and visit window
- Link a ticket to:
  - a customer
  - a client machine
  - an optional related order
- Assign one or more technicians to a ticket
- Maintain a proposed parts list for the ticket
- Record visit-date changes for auditability
- Provide list and detail screens for service coordinators
- Emit ticket lifecycle events for schedule integration

### In Scope for Post-MVP Improvements

- Fix working DataTable filters for status, service type, and priority
- Replace manual customer UUID entry with company autocomplete
- Add a cascading contact-person selector filtered by the selected company

### Out of Scope

- PDF service protocols
- Cost calculation and billing logic
- Advanced technician skill-matching logic
- Automated route optimization
- Customer self-service portal flow
- Rich parts inventory reservation flow

## Key Workflows

### 1. Register a Service Ticket

The coordinator creates a new ticket, enters the issue description, sets service type and priority, chooses the customer, links the affected machine, and optionally proposes a visit time.

### 2. Assign Technicians

The coordinator assigns one or more technicians to the ticket. This assignment becomes the basis for schedule reservations in the related scheduling module.

### 3. Reschedule a Visit

If the visit date changes, the system stores the previous and new dates in a history log so the team can understand rescheduling activity.

### 4. Prepare for the Visit

The coordinator or technician adds a parts list to the ticket so the team can prepare likely required materials before the visit.

### 5. Filter and Manage Workload

Users can review tickets by status, service type, and priority, search for specific cases, and quickly navigate to ticket details.

## Functional Requirements

### Ticket Record

Each ticket must support:
- Unique ticket number
- Service type
- Status
- Priority
- Description
- Visit start and end date
- Service address
- Customer reference
- Client machine reference
- Optional related order reference
- Assigned technicians

### Status Handling

The solution should support at least these statuses:
- New
- Scheduled
- In Progress
- Completed
- On Hold
- Cancelled

### Parts Handling

The user must be able to add, edit, and remove parts linked to a ticket, including quantity and notes.

### Change Traceability

The system must store date-change history when visit timing is modified.

### Filtering and Search

The ticket list must support:
- Status filter
- Service type filter
- Priority filter
- Search by ticket number or description
- Visit date range filtering

### Customer Selection UX

The module should provide:
- Company autocomplete instead of raw UUID entry
- Contact-person selection limited to contacts belonging to the chosen company

## Dependencies and Integrations

The ticket module depends on:
- `customers` for company and contact data
- `client_machines` for installed customer machine records
- `service_technicians` and `staff` for technician references
- `service_schedule` for downstream reservation creation
- `catalog` for parts references
- `attachments` and `audit_logs` as future-friendly supporting modules

## Delivery Plan

### Phase 1: MVP

Deliver the operational core:
- Ticket CRUD
- Assignment management
- Parts list
- Date-change history
- List and detail UI
- Event emission for schedule integration

### Phase 2: Usability Improvements

Deliver workflow polish:
- Fix broken list filters
- Add company autocomplete
- Add dependent contact-person selection

## Acceptance Criteria

### MVP Acceptance Criteria

- A coordinator can create a service ticket from the backend UI
- A ticket can be linked to a customer and machine
- One or more technicians can be assigned to the ticket
- A planned visit date can be stored and later updated
- When the visit date changes, a history entry is recorded
- A parts list can be maintained on the ticket
- Tickets can be listed, viewed, edited, and deleted from the backend UI
- Ticket lifecycle events are available for schedule integration

### Improvement Acceptance Criteria

- Status, service type, and priority filters change list results correctly
- The company field supports search-based selection
- After selecting a company, the user can choose a contact person associated with that company
- Changing the selected company clears and reloads the contact-person options

## Risks & Impact Review

| Risk | Severity | Affected Area | Mitigation | Residual Risk |
|---|---|---|---|---|
| Manual linking across modules may cause inconsistent references if dependent records are missing | Medium | Ticket data quality | Use validated UUID references and search-based selectors | Medium |
| Schedule automation depends on downstream subscriber work outside this module | Medium | End-to-end planning flow | Keep event contract explicit and verify integration after merge | Medium |
| Hackathon time constraints may push usability work after MVP | Medium | User adoption | Prioritize operational core first, deliver UX fixes in Phase 2 | Low |
| Ticket numbering based on simple sequencing may need strengthening later | Low | Operational scale | Keep current approach for hackathon speed, revisit for concurrent production usage | Medium |

## Open Questions

- Should contact-person selection become mandatory when the selected customer is a company?
- Should ticket creation require a machine reference, or remain optional for intake-stage cases?
- Which status changes should trigger user notifications in later phases?
- Do we want explicit SLA targets in the next iteration?

## Architecture Summary

The module is part of a four-module service-management solution:
- `service_tickets` is the operational hub
- `client_machines` stores installed customer assets
- `service_technicians` extends team-member data for service operations
- `service_schedule` manages reservations and calendar visibility

The modules communicate through references and events rather than tight coupling, allowing parallel implementation and cleaner future evolution.

## Data Model Summary

The product scope requires these logical records:
- **Service Ticket**: the primary work-order record
- **Ticket Assignment**: technician-to-ticket assignment
- **Ticket Part**: proposed part or material linked to the ticket
- **Ticket Date Change**: history of planned-date updates

## API Contracts

The engineering design supports:
- CRUD APIs for service tickets
- CRUD APIs for ticket assignments
- CRUD APIs for ticket parts

For product review, the important contract expectation is:
- ticket data must be listable, editable, and linkable to related operational records
- list filtering must behave consistently with the UI controls

## Backward Compatibility Notes

This is a new module and therefore does not intentionally break existing platform contracts. Integration points with other modules should remain additive, especially event payloads and API response shapes.

## Final Compliance Report

- Includes required spec sections: TLDR, Overview, Problem Statement, Proposed Solution, Architecture, Data Model Summary, API Contracts, Risks & Impact Review, Final Compliance Report, Changelog
- Distilled from the system-level spec plus both `service_tickets` plans
- Written for stakeholder readability while preserving implementation intent
- Keeps MVP scope and follow-up improvements clearly separated

## Changelog

- **2026-04-11**: Created a PO-friendly distilled specification for the `service_tickets` module based on the broader service-management spec and both P1 implementation plans.
