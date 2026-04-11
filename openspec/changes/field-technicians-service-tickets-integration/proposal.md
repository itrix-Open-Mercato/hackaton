## Why

The service_tickets module already assigns staff members to tickets via `ServiceTicketAssignment`, but the assignment is a blind UUID reference — there's no technician profile, no skill matching, and no visibility into who is qualified or available. The hackathon spec (Karta Serwisanta) requires a dedicated technician profile module so dispatchers can assign the right person based on skills, certifications, and availability. Without this, ticket assignment remains guesswork.

## What Changes

- **New `technicians` module** — technician profiles linked to existing `staff` members, with skills (tags), certifications (with expiry dates), and notes
- **Skill-based filtering on ticket assignment** — when assigning technicians to a service ticket, the UI shows available technicians filtered by relevant skills/certifications
- **Technician detail page (Karta Serwisanta)** — backend admin page showing technician profile, assigned skills, certifications, and a history of ticket assignments
- **Service ticket form enrichment** — the ticket form's staff assignment section shows technician names, skills, and availability instead of raw UUIDs
- **Technician availability flag** — simple active/inactive status per technician to exclude unavailable staff from assignment

## Capabilities

### New Capabilities
- `technician-profiles`: CRUD for technician profiles (linked to staff member), skills tags, certifications with expiry, active/inactive status
- `technician-ticket-assignment`: Enriched technician picker on service ticket form with skill filtering, availability check, and display of technician details
- `technician-detail-page`: Backend admin page (Karta Serwisanta) showing technician profile, skills, certifications, and assignment history

### Modified Capabilities
_(none — service_tickets already stores `staff_member_ids`; we enrich the UI and add filtering, but the ticket entity/API schema does not change)_

## Impact

- **New DB tables**: `technicians`, `technician_skills`, `technician_certifications` (new module, new migration)
- **New module registration**: `{ id: 'technicians', from: '@app' }` in `src/modules.ts`
- **service_tickets UI**: Ticket create/edit form gains a technician picker component (replaces or augments current raw UUID input for staff assignment)
- **Cross-module references**: `technicians` references `staff` member IDs (foreign key, no ORM relation); `service_tickets` already references staff via `ServiceTicketAssignment.staffMemberId`
- **API**: New `/api/technicians` CRUD endpoints; existing `/api/service-tickets` unchanged (assignment data enriched via response enricher)
- **Dependencies**: `technicians` depends on `staff` (core); `service_tickets` optionally enriches from `technicians` if present
