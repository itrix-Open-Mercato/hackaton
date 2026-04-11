# Technician Schedule Module

**Date**: 2026-04-11
**Status**: Draft

## TLDR

**Key Points:**
- New module `technician_schedule` (`src/modules/technician_schedule/`) provides a calendar view of technician availability and manages time reservations (client visits, internal work, leave, training).
- Reservations (`TechnicianReservation`) are created **automatically** by an Event Subscriber listening on `service_orders.service_order.technician_assigned` — saving a Service Order with an assigned technician and time slot instantly creates a block in the Schedule without any coordinator action.
- A single trip can involve **multiple technicians** (a field crew) — M2M relationship via junction table `technician_reservation_technicians`; overlap is checked per technician.
- Overlap validation: scheduling two reservations for the same technician in the same time window is blocked at the command layer.
- Calendar view powered by the existing `ScheduleView` from `@open-mercato/ui/backend/schedule/ScheduleView` (built on `react-big-calendar`).
- **No approval flow** in this phase — all reservations are created with status `confirmed` or `auto_confirmed`.

**Scope (Phase 1):**
- `TechnicianReservation` entity + `TechnicianReservationTechnician` junction table
- CRUD API with `openApi`, Zod validation, overlap check
- Undoable commands for all mutations
- Subscriber auto-creating reservations from Service Orders (`service_orders.service_order.technician_assigned`)
- Backend UI: calendar page (week/month view), create/edit/cancel reservation forms
- Filtering by technician, reservation type, date range
- Color-coded reservation types in the calendar
- ACL: `view` and `manage`
- i18n: `pl` and `en`

**Scope (Phase 2 — planned):**
- Reservation approval flow (`AWAITING_APPROVAL` → `CONFIRMED` / `REJECTED`)
- Per-technician view (Technician Card page links to their schedule)
- Notifications (flash + SSE) on conflict detection
- Schedule export to PDF / iCal

---

## Overview

The `technician_schedule` module solves the coordination problem for field service companies. When a coordinator assigns a technician to a service order (`service_orders`), a time block immediately appears in the Schedule with no extra steps. The coordinator sees the entire team's availability in a single calendar view, can manually add absences (leave, training), and the system automatically prevents double-booking any technician.

**External cross-module references (FK IDs, no ORM joins):**
- `field_technicians` — `technician_id` per reservation
- `service_orders` — `source_order_id` (nullable) — originating order
- `fleet` — `vehicle_id` (nullable) — vehicle assigned to the trip

**Calendar:** Reuses `ScheduleView` + `ScheduleToolbar` from `@open-mercato/ui/backend/schedule/` (react-big-calendar with date-fns). Multi-row resource view (one row per technician) requires the resource grid layout — in Phase 1 we use the standard week view with per-type color coding and a single-technician filter. The multi-resource view (all technicians simultaneously) is deferred to Phase 2.

> **Market Reference**: Similar approach used by Fieldwire and ServiceMax — reservations auto-created from work orders, group view in a resource×time grid. Phase 1 uses the simpler path (one calendar + technician filter) instead of a complex resource grid.

## Problem Statement

Without a dedicated Schedule, the coordinator must:
1. Save the Service Order with the assigned technician and time slot.
2. Separately open the calendar/spreadsheet and manually add the availability block.
3. Remember to update both places every time the order changes.

This results in double-bookings, forgotten leave blocks, and coordinators answering "is Smith available on Wednesday?" by phone instead of through the system.

## Proposed Solution

Introduce a `technician_schedule` module containing:

1. A `TechnicianReservation` entity — a precise time block (start/end timestamps) with type and status.
2. A `TechnicianReservationTechnician` junction table — M2M technician↔reservation (field crew).
3. An Event Subscriber on `service_orders.service_order.technician_assigned` — automatic reservation creation or update without coordinator intervention.
4. Overlap validation in the create/update command: a DB query before the write checks that none of the assigned technicians already has a reservation in the given time window.
5. Backend UI: calendar page with `ScheduleView`, `CrudForm` for manual reservations.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `technician_schedule` module, not an extension of `field_technicians` | The Schedule is a distinct domain — it has its own entities, view, and events. `field_technicians` already has `FieldTechnicianAvailability` (day-level); reservations are time-precise and a different semantic layer |
| M2M via junction table, not `jsonb[]` technician_ids | We need the ability to filter "reservations for technician X", per-technician overlap checks, and potential per-technician status extension for crew members in Phase 2 |
| Overlap check in the command layer (not a DB constraint) | `makeCrudRoute` does not support async pre-save hooks with DB queries; a DB `EXCLUDE USING gist` constraint requires the `btree_gist` extension which we cannot guarantee. A command-layer SELECT-before-INSERT is sufficient for single-user UI write flows |
| Status: `auto_confirmed` / `confirmed` / `cancelled` (no `awaiting_approval`) | Per Q4 answer — approval flow is planned in a separate module |
| Reuse `ScheduleView` instead of a custom component | Library already installed (`react-big-calendar` in package.json); `ScheduleView` provides toolbar, navigation, date-range handling, and `eventPropGetter` styling |
| `source_type` on reservation (`service_order` / `manual`) | Allows fast filtering of auto-created vs. manual reservations; manual ones are freely editable, auto ones are kept in sync with the originating order |

## User Stories

- **Coordinator** wants to see the availability of all technicians for the week so they immediately know who is free when a new order arrives.
- **Coordinator** wants a time block to appear automatically in the Schedule after saving a Service Order with an assigned technician — no extra steps.
- **Coordinator** wants to manually add a technician's leave or training so the block is visible when planning orders.
- **Dispatcher** wants to view reservation details (client, address, duration) directly from the calendar view.
- **Coordinator** wants to cancel a manual or order-linked reservation (e.g. rescheduling) while the system prevents placing a new reservation on top of an existing one.

## Architecture

**Module path:** `src/modules/technician_schedule/`

```
src/modules/technician_schedule/
├── index.ts                 # Module metadata (id, label, icon from lucide-react)
├── di.ts                    # Awilix DI registrations (ReservationService)
├── data/
│   ├── entities.ts          # TechnicianReservation, TechnicianReservationTechnician
│   └── validators.ts        # Zod schemas
├── api/
│   ├── technician-reservations/route.ts
│   ├── technician-reservations/cancel/route.ts
│   └── technician-reservations/technicians/route.ts
├── backend/
│   └── technician-schedule/
│       ├── page.tsx         # Calendar view (reservations mapped to ScheduleItems)
│       └── create/page.tsx  # Manual reservation form
├── subscribers/
│   └── onServiceOrderTechnicianAssigned.ts   # Auto-create reservation (exports metadata)
├── commands/
│   └── reservations.ts      # create / update / cancel (undoable, with before/after snapshots)
├── events.ts
├── acl.ts
├── setup.ts
├── lib/
│   └── overlapCheck.ts      # Overlap validation helper (EntityManager injected via DI)
└── i18n/
    ├── en.json
    └── pl.json
```

Register in `src/modules.ts`: `{ id: 'technician_schedule', from: '@app' }`

**DI (`di.ts`):** `ReservationService` registered as a scoped Awilix service; `overlapCheck` receives `em` via DI — never instantiated with `new` directly.

### Commands

All commands are **undoable** and must capture `before`/`after` snapshots for the undo mechanism.

| Command ID | Purpose | Undo logic |
|------------|---------|------------|
| `technician_schedule.reservation.create` | Create reservation + junction rows (atomically) | Soft-delete the reservation + remove junction rows |
| `technician_schedule.reservation.update` | Update reservation fields + replace junction rows | Restore previous field values + restore previous junction rows |
| `technician_schedule.reservation.cancel` | Set `status = 'cancelled'` (does not delete the record) | Restore the previous status (`confirmed` or `auto_confirmed`) |

**Transaction boundary**: every mutating command must execute the `TechnicianReservation` write and all `TechnicianReservationTechnician` operations within a single `withAtomicFlush`. A partial write (reservation without junction rows) is not acceptable.

### Events

Declared in `events.ts` via `createModuleEvents` with `as const`. All four must be declared before being emitted.

| Event ID | Trigger |
|----------|---------|
| `technician_schedule.reservation.created` | Reservation created (manually or automatically) |
| `technician_schedule.reservation.updated` | Reservation updated |
| `technician_schedule.reservation.cancelled` | Reservation cancelled |
| `technician_schedule.reservation.conflict_detected` | Overlap detected (emitted by subscriber instead of blocking the write) |

### Subscriber

**`onServiceOrderTechnicianAssigned`** — listens on `service_orders.service_order.technician_assigned`.

The file must export `metadata` required by auto-discovery:
```typescript
export const metadata = {
  id: 'technician_schedule.onServiceOrderTechnicianAssigned',
  event: 'service_orders.service_order.technician_assigned',
  persistent: true,
}
```

Expected event payload from the `service_orders` module:
```typescript
{
  orderId: string
  technicianIds: string[]     // one or more (field crew)
  startsAt: string            // ISO 8601 datetime
  endsAt: string              // ISO 8601 datetime
  vehicleId?: string
  customerName?: string
  address?: string
  organizationId: string
  tenantId: string
}
```

Subscriber logic:
1. Check whether a reservation exists with `source_order_id = orderId` and `source_type = 'service_order'`.
2. If it exists → execute `technician_schedule.reservation.update` (update time, technicians, vehicle).
3. If it does not exist → execute `technician_schedule.reservation.create`.
4. Run overlap check before write — if a conflict is found → log the error and emit `technician_schedule.reservation.conflict_detected` (do not block — in Phase 1 the coordinator is informed via UI).

## Data Models

### TechnicianReservation
Table: `technician_reservations`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `organization_id` | uuid | no | tenant scoping |
| `tenant_id` | uuid | no | tenant scoping |
| `title` | text | no | displayed in calendar; auto-generated from type + technician name |
| `reservation_type` | text | no | `client_visit` \| `internal_work` \| `leave` \| `training` |
| `status` | text | no | `auto_confirmed` \| `confirmed` \| `cancelled`; default `confirmed` |
| `source_type` | text | no | `service_order` \| `manual`; default `manual` |
| `source_order_id` | uuid | yes | FK ref to `service_orders` — no ORM join |
| `starts_at` | timestamptz | no | precise start datetime |
| `ends_at` | timestamptz | no | precise end datetime |
| `vehicle_id` | uuid | yes | FK ref to `fleet` — no ORM join |
| `vehicle_label` | text | yes | denormalised vehicle display name |
| `customer_name` | text | yes | denormalised client name (from Service Order) |
| `address` | text | yes | service address (from Service Order) |
| `notes` | text | yes | additional information |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `deleted_at` | timestamptz | yes | soft-delete |

Indexes:
- `(tenant_id, organization_id)` — tenant scoping
- `(tenant_id, organization_id, starts_at, ends_at)` — overlap queries and date-range filtering
- `(source_order_id)` — lookup by order (partial: where source_type = 'service_order')

### TechnicianReservationTechnician
Table: `technician_reservation_technicians`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | no | |
| `reservation_id` | uuid | no | FK ref to `technician_reservations.id` |
| `technician_id` | uuid | no | FK ref to `field_technicians.id` — no ORM join |
| `organization_id` | uuid | no | tenant scoping |
| `tenant_id` | uuid | no | tenant scoping |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | required by standard columns |

Indexes:
- `(reservation_id)` — lookup by reservation
- `(technician_id, reservation_id)` — unique constraint (one technician once per reservation)
- `(tenant_id, organization_id, technician_id)` — overlap check per technician

## API Contracts

All routes export `openApi`.

### `GET /api/technician-reservations`
Query parameters:
- `page`, `pageSize` (max 100, default 50)
- `technicianId` — filters via junction table (reservations containing this technician)
- `reservationType` — exact match: `client_visit` \| `internal_work` \| `leave` \| `training`
- `status` — exact match: `auto_confirmed` \| `confirmed` \| `cancelled`
- `startsAtFrom` — ISO 8601; reservations with `starts_at >= startsAtFrom` (lower bound of calendar range)
- `startsAtTo` — ISO 8601; reservations with `starts_at <= startsAtTo` (upper bound of calendar range)
- `sourceOrderId` — filter by originating order
- `ids` — comma-separated UUIDs
- `sortField` — `starts_at` (default) \| `ends_at` \| `created_at`
- `sortDir` — `asc` (default) \| `desc`

Response: paged list; each item includes embedded `technicians[]` (list of technicianIds) from the junction table.

### `POST /api/technician-reservations`
Body: `TechnicianReservationCreateInput`
Required: `tenantId`, `organizationId`, `reservationType`, `startsAt`, `endsAt`, `technicianIds` (array min 1)
Optional: `title`, `sourceOrderId`, `sourceType`, `vehicleId`, `vehicleLabel`, `customerName`, `address`, `notes`
Response: `{ id: string }` — 201
Error responses: 400 (Zod validation failure), 403 (missing feature), 409 (overlap conflict — body: `{ error: 'OVERLAP_CONFLICT', conflictingTechnicianIds: string[] }`)

### `PUT /api/technician-reservations`
Body: `TechnicianReservationUpdateInput` — must include `id`; all other fields optional patch semantics
Response: `{ ok: true }`
Error responses: 400 (Zod), 403 (missing feature), 404 (reservation not found), 409 (overlap conflict)

### `DELETE /api/technician-reservations?id=<uuid>`
Soft-deletes the reservation.
Response: `{ ok: true }`
Error responses: 403 (missing feature), 404 (not found)

### `POST /api/technician-reservations/cancel`
Body: `{ id: string, notes?: string }`
Sets status to `cancelled`.
Response: `{ ok: true }`
Error responses: 403 (missing feature), 404 (not found), 422 (already cancelled)

### `GET /api/technician-reservations/technicians`
Returns the technician list for a given reservation.
Query: `reservationId` (required), `page`, `pageSize`
Response: paged list `{ id, reservation_id, technician_id, created_at }`

### Route Auth Guards

| Route | Method | Required feature |
|-------|--------|----------------|
| `/api/technician-reservations` | `GET` | `technician_schedule.view` |
| `/api/technician-reservations` | `POST` / `PUT` / `DELETE` | `technician_schedule.manage` |
| `/api/technician-reservations/cancel` | `POST` | `technician_schedule.manage` |
| `/api/technician-reservations/technicians` | `GET` | `technician_schedule.view` |

## ACL & Feature IDs

| Feature ID | Purpose | Default roles |
|------------|---------|---------------|
| `technician_schedule.view` | View schedule and reservations | `admin`, `employee` |
| `technician_schedule.manage` | Create, edit, and cancel reservations | `admin` |

## UI / UX

### Backend Routes
- `/backend/technician-schedule` — calendar view with reservation list
- `/backend/technician-schedule/create` — manual reservation form

### Calendar Page (`/backend/technician-schedule`)

**Toolbar (above the calendar):**
- Technician filter — `Select` (from `@open-mercato/ui/primitives/select`) with list of active technicians (optional; without selection all technicians are shown)
- Reservation type filter — multi-select checkboxes (Client Visit / Internal Work / Leave / Training)
- "Add reservation" button — navigates to `/backend/technician-schedule/create`

**Calendar:** `ScheduleView` from `@open-mercato/ui/backend/schedule/ScheduleView`
- Views: `week` (default), `month`, `day`, `agenda`
- `items` = reservations mapped to `ScheduleItem[]`:
  - `id`, `title`, `startsAt`, `endsAt`
  - `kind`: `event` (client_visit) \| `exception` (leave / training) \| `availability` (internal_work)
  - `linkLabel`: "Order" (when `source_order_id` is populated)
- `onItemClick` — opens a drawer/modal with reservation details: order, client, address, technicians, duration, notes, status
- `onSlotClick` — pre-fills the `/create` form with the selected time range

**Reservation type colours** (via `eventPropGetter` in `ScheduleView`; colours use Tailwind CSS variables — no hardcoded hex):

| Type | `ScheduleItem.kind` | Style |
|------|---------------------|-------|
| `client_visit` | `event` | Default blue from `ScheduleView` |
| `internal_work` | `availability` | Default green from `ScheduleView` |
| `leave` | `exception` | Default grey from `ScheduleView` |
| `training` | `event` + `eventPropGetter` override | Orange via `var(--color-warning)` from theme — no inline hex |

**Page states:**
- **Loading**: `LoadingMessage` from `@open-mercato/ui/backend/detail` until the reservation list is fetched
- **Fetch error**: `ErrorMessage` with a retry action
- **No reservations in range**: `EmptyState` with an "Add reservation" button

### Manual Reservation Form (`/backend/technician-schedule/create`)

`CrudForm` with groups:
- **Type**: `reservation_type` (Select), status auto-set to `confirmed`
- **Time slot**: `starts_at` (DateTimePicker), `ends_at` (DateTimePicker) — validation: `ends_at > starts_at`
- **Technicians**: `technician_ids` — multi-select from the list of active technicians
- **Vehicle**: `vehicle_id` + `vehicle_label` (optional, from fleet module)
- **Trip details**: `customer_name`, `address` (optional)
- **Notes**: `notes`

On save → `flash('Reservation created', 'success')` + redirect to calendar.
`Cmd/Ctrl+Enter` to submit, `Escape` to cancel.

### Reservation Detail (Drawer/Modal on calendar block click)

- Title + reservation type (colour badge)
- Status badge
- Date and time range
- Technician list (links to Technician Cards)
- Vehicle (link to Fleet if `vehicle_id` is set)
- Order (link to Service Order if `source_order_id` is set)
- Client and address
- Notes
- Actions: "Edit" (only for `source_type = manual`), "Cancel reservation" (`ConfirmDialog` from `@open-mercato/ui/backend/confirm-dialog`)

## Implementation Plan

### Phase 1 — Core

1. **Entities and migration** — `data/entities.ts`: `TechnicianReservation`, `TechnicianReservationTechnician`; run `yarn mercato db generate`
2. **Validators** — `data/validators.ts`: Zod create/update schemas with `ends_at > starts_at` validation
3. **Overlap check helper** — `lib/overlapCheck.ts`: async function that SELECTs per `technicianId` for collisions in `starts_at..ends_at` (excluding `cancelled` and optionally the current id on update)
4. **Commands** — `commands/reservations.ts`: `create`, `update`, `cancel` with undoable support and before/after snapshots; each mutating command wraps reservation + junction table writes in `withAtomicFlush`
5. **API route** — `api/technician-reservations/route.ts`: `makeCrudRoute` with `openApi`; GET joins junction table to return `technicians[]` per item
6. **API route (junction)** — `api/technician-reservations/technicians/route.ts`: GET by reservationId
7. **Cancel endpoint** — `api/technician-reservations/cancel/route.ts`: POST → cancel command
8. **Subscriber** — `subscribers/onServiceOrderTechnicianAssigned.ts`: listens on `service_orders.service_order.technician_assigned`, idempotent create-or-update of reservation; exports `metadata`
9. **Backend — calendar page** — `backend/technician-schedule/page.tsx`: `ScheduleView` with filter toolbar, data fetched via `apiCall`, reservations mapped to `ScheduleItem[]`
10. **Backend — create form** — `backend/technician-schedule/create/page.tsx`: `CrudForm`
11. **Events** — `events.ts`: `createModuleEvents` with `as const` (all 4 events)
12. **ACL + Setup** — `acl.ts`, `setup.ts`: feature declarations and default role assignments
13. **i18n** — `i18n/en.json`, `i18n/pl.json`: all user-facing strings
14. **Module registration** — `src/modules.ts`: `{ id: 'technician_schedule', from: '@app' }`

### Phase 2 — Approval Flow & Enhanced Views

1. `awaiting_approval` status and Accept/Reject coordinator actions
2. Multi-resource view (technician × time grid) — react-big-calendar `resourceId` mode
3. Calendar widget on the Technician Card page (`field_technicians/[id]`)
4. Notification on conflict detection
5. iCal export per technician

## Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| `service_orders` module does not yet emit `technician_assigned` | High | Subscriber is defined defensively — if the event is not present in the system the subscriber simply never fires. Integration requires only declaring the event in `service_orders` | Manual reservation creation is available immediately; auto-integration activates when `service_orders` emits the event |
| Overlap check at command layer susceptible to race conditions under concurrent writes | Medium | Acceptable risk at Phase 1 (UI single-user flow). Phase 2: DB advisory lock or UNIQUE constraint | Theoretical double-booking possible under simultaneous millisecond writes |
| Field crew — one technician busy, others free | Medium | Overlap check queries each `technicianId` independently; blocks the entire write if **any** member is busy; UI reports which specific technician conflicts | User must manually adjust the crew or reschedule |
| `ScheduleView` does not natively support multi-resource row layout | Medium | Phase 1: single-technician filter + standard week view. Phase 2: react-big-calendar `resourceId` prop or custom component | "View all technicians simultaneously" not available in Phase 1 |
| Denormalised fields (`customer_name`, `address`) may become stale | Low | Informational fields, not transactional — acceptable. Subscriber re-upserts with fresh data on order update | Minimal risk; calendar view is a snapshot at reservation creation time |

## Spec Compliance Report

### Spec Checklist

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | TLDR defines scope, value, and clear boundaries | ✅ | |
| 2 | MVP explicit; future work deferred and labeled | ✅ | Phase 1 / Phase 2 |
| 3 | User stories map to API/data/UI sections | ✅ | |
| 4 | Phase plan testable and incrementally deliverable | ✅ | |
| 5 | Cross-module links use FK IDs only | ✅ | source_order_id, vehicle_id, technician_id — all FK, no ORM join |
| 6 | Tenant isolation and organization_id scoping explicit | ✅ | Both entities + all queries |
| 7 | Module placement in `src/modules/<id>/` | ✅ | |
| 8 | DI usage specified (Awilix) | ✅ | di.ts added, ReservationService via DI |
| 9 | Event/subscriber boundaries clear and non-circular | ✅ | Subscriber consumes external event; emits own module events |
| 10 | Entities include id, organization_id, created_at, updated_at | ✅ | Including junction table |
| 11 | Write operations define transaction boundaries | ✅ | withAtomicFlush specified for junction table writes |
| 12 | Input validation uses Zod schemas | ✅ | validators.ts + Zod in routes |
| 13 | Auth guards declared (requireAuth, requireFeatures) | ✅ | Full route auth guard table |
| 14 | Naming is singular and consistent | ✅ | TechnicianReservation (entity), reservation.create (command), reservation.created (event) |
| 15 | All mutations are commands with undo logic | ✅ | Before/after snapshots documented per command |
| 16 | Events declared in events.ts before emitting | ✅ | All 4 events including conflict_detected |
| 17 | Side-effect reversibility documented | ✅ | Undo column in Commands table |
| 18 | API contracts complete (request/response/errors) | ✅ | Including 400/403/409/404/422 |
| 19 | Routes include openApi expectations | ✅ | |
| 20 | UI uses CrudForm, shared primitives | ✅ | CrudForm + ScheduleView (approved shared component) |
| 21 | i18n keys planned | ✅ | en.json + pl.json |
| 22 | Pagination limits defined (pageSize <= 100) | ✅ | max 100, default 50 |
| 23 | Risks include concrete scenarios with severity and mitigation | ✅ | |
| 24 | No cross-module ORM links | ✅ | |
| 25 | Loading/error/empty states documented | ✅ | LoadingMessage, ErrorMessage, EmptyState |
| 26 | Subscriber exports metadata | ✅ | metadata export documented |

### Non-Compliant Items Fixed During Review
- Added `conflict_detected` event to Events table (was emitted but not declared)
- Added subscriber `metadata` export contract
- Added `di.ts` to module file tree + DI specification
- Added `withAtomicFlush` transaction boundary for junction table writes
- Added undo logic per command in Commands table
- Added error responses (400/403/404/409/422) to all API contracts
- Added `/cancel` route to Route Auth Guards table
- Fixed `startsAtFrom` filter description (was semantically incorrect)
- Added `updated_at` to `TechnicianReservationTechnician`
- Added LoadingMessage/ErrorMessage/EmptyState to UI section
- Replaced hardcoded colour mention with `var(--color-warning)` CSS variable

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial skeleton spec with Open Questions |
| 2026-04-11 | Full spec after Q1–Q5 answers — complete architecture, data models, API contracts, implementation plan |
| 2026-04-11 | Code-review pass — 11 non-compliant items fixed (see Spec Compliance Report) |
| 2026-04-11 | Translated to English |
