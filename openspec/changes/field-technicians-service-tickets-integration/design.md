## Context

The `service_tickets` module already tracks staff assignments via `ServiceTicketAssignment` (linking `staffMemberId` UUIDs to tickets). The core `staff` module exists but has no concept of technician-specific data like skills, certifications, or availability. The ticket form currently accepts raw staff member UUIDs with no visibility into who is qualified.

We need a `technicians` module that enriches staff members with field-service profile data, and integrates into the service ticket assignment flow.

## Goals / Non-Goals

**Goals:**
- Create a standalone `technicians` module following the same patterns as `service_tickets` and `resources`
- Store technician profiles linked to staff members (1:1 by staff_member_id)
- Store skills as tags and certifications with expiry dates
- Provide a backend admin list + detail page (Karta Serwisanta)
- Expose a `/api/technicians` CRUD API
- Provide a technician picker component that the service ticket form can use for staff assignment

**Non-Goals:**
- Availability calendar / scheduling (that's the `schedule` module)
- Automated skill matching algorithm (manual filtering is sufficient for hackathon)
- Technician self-service portal
- Integration with external HR systems

## Decisions

### 1. Separate `technicians` module, not extension of `staff`

The `staff` module is a core `@open-mercato/core` module. Extending it via UMES would be possible for adding columns, but we need custom entities (skills, certifications), a dedicated detail page, and a custom API. A standalone `@app` module is simpler and avoids ejecting core.

**Alternative considered:** UMES extension on `staff` — rejected because we need multiple child entities (skills, certifications) and a fully custom detail page, which goes beyond UMES column/field injection.

### 2. Entity structure: Technician → Skills (tags) + Certifications

- `Technician` — links to a staff member via `staffMemberId` (UUID FK, no ORM relation). Has `isActive` boolean and `notes` text.
- `TechnicianSkill` — ManyToOne to Technician. Stores `name` (text). Skills are free-form tags (no separate dictionary entity for hackathon simplicity).
- `TechnicianCertification` — ManyToOne to Technician. Stores `name`, `issuedAt`, `expiresAt`, `certificateNumber`.

**Alternative considered:** Using the `dictionaries` core module for skills — rejected for hackathon speed; free-form text tags are sufficient.

### 3. Technician picker via widget injection into service ticket form

Rather than modifying the service_tickets module directly, the technicians module will inject a widget into the ticket form's staff assignment area. This uses the existing `staff_member_ids` field — the picker just provides a better UI for selecting them.

The widget will:
- Fetch active technicians from `/api/technicians`
- Display name, skills, and active status
- Allow multi-select (since tickets support multiple assignments)
- Write selected IDs back to the form's `staff_member_ids` field

### 4. API design follows existing CRUD patterns

Follows the same `makeCrudRoute` + command pattern as `service_tickets`. Skills and certifications are sub-resources managed through the technician detail page (inline create/delete, not separate CRUD routes).

### 5. Migration written manually

Per CLAUDE.md, `yarn mercato db generate` is broken for `@app` modules on Node 24. We'll write the migration manually with `IF NOT EXISTS` guards.

## Risks / Trade-offs

- **Staff member data not enriched in technician list** — We store only `staffMemberId`; displaying the staff member's name requires a response enricher or client-side join. → Mitigation: Add a response enricher that resolves staff member names, or fetch staff data client-side.
- **No uniqueness enforcement on skill names per technician** — Could get duplicate skill tags. → Mitigation: Deduplicate in the UI; add DB unique constraint on `(technician_id, name)`.
- **Technician-ticket integration is UI-only** — The ticket API doesn't validate that assigned staff are active technicians. → Acceptable for hackathon; validation can be added later.
