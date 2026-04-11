# Agents Review Findings Against `main`

Base branch comparison:
- Merge base: `94c980653ddf64cd54573c31d34655dd73b7ff39`
- Review target: current agents changes against `main`

## Finding 1

File: `src/modules/service_tickets/data/entities.ts:13`

Priority: `P1`

Title: Generate a migration for the new service ticket tables

This patch adds four ORM entities for the `service_tickets` module, but there is no generated `src/modules/service_tickets/migrations/Migration*.ts` in the diff; the only schema artifact touched is the unrelated `resources` snapshot. On an existing installation, `yarn mercato db migrate` will not create these tables, so the new `/api/service_tickets/*` routes will fail immediately with missing-relation errors.

## Finding 2

File: `src/modules/service_tickets/components/ticketFormConfig.tsx:159-160`

Priority: `P1`

Title: Convert API timestamps before filling `datetime-local` inputs

`mapTicketToFormValues()` slices the ISO timestamp returned by the API and puts it straight into a `datetime-local` field. Because the API value is UTC (`...Z`) while `datetime-local` is interpreted in the browser's local timezone, opening an existing ticket and saving it in any non-UTC timezone shifts `visit_date` and `visit_end_date` by the local offset even when the user never changed the schedule.

## Finding 3

File: `src/modules/service_tickets/data/validators.ts:26`

Priority: `P1`

Title: Reject duplicate staff ids before inserting assignments

`staff_member_ids` accepts duplicate UUIDs here, but `createTicketCommand` and `updateTicketCommand` insert assignments one by one against the `sta_ticket_staff_unique` constraint. A payload like `["user-a","user-a"]` will raise on the second insert after the ticket (and possibly earlier assignments) has already been flushed, leaving partially-written data and a 500 response instead of a clean validation error.

## Finding 4

File: `src/modules/service_tickets/api/openapi.ts:22-23`

Priority: `P2`

Title: Align the ticket list OpenAPI schema with the actual payload

`GET /api/service_tickets/tickets` transforms rows to camelCase keys such as `ticketNumber`, `serviceType` and `visitDate`, but this schema still documents snake_case fields like `ticket_number` and `service_type`. The generated OpenAPI therefore advertises the wrong response shape, which will break response validation and any generated client code built from the published contract.

## Finding 5

File: `src/modules/service_tickets/data/validators.ts:19-20`

Priority: `P2`

Title: Validate visit date fields as datetimes instead of free-form strings

`visit_date` and `visit_end_date` currently accept any string. The command layer immediately does `new Date(parsed.visit_date)` / `new Date(parsed.visit_end_date)`, so inputs like `"tomorrow afternoon"` pass validation here and then fail later as invalid timestamps, turning a bad request into a 500 from the ORM/database instead of a deterministic 400 validation error.

## Overall Verdict

- Overall correctness: `patch is incorrect`
- Notes: The patch introduces several correctness issues: the new module is not migratable on existing databases, editing scheduled timestamps will shift them by timezone, and some accepted payloads can either partially persist or surface the wrong API contract.
- Verification limitation: local `yarn` checks were blocked because this environment has Node `20.19.2` while the project now requires Node `>=24.0.0`.
