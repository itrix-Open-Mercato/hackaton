# Technician Schedule Module — Implementation Tasks

**Spec**: `.ai/specs/2026-04-11-technician-schedule-module.md`
**Module path**: `src/modules/technician_schedule/`
**Branch**: `feature/field-technicians-ui-fixes` (extend or cut new branch)

---

## Status Legend
- [ ] Not started
- [x] Done

---

## Phase 1 — Core Implementation

### 1. Entities & Migration
- [ ] Create `src/modules/technician_schedule/data/entities.ts`
  - `TechnicianReservation` entity (table: `technician_reservations`)
    - Fields: `id`, `organization_id`, `tenant_id`, `title`, `reservation_type`, `status`, `source_type`, `source_order_id`, `starts_at`, `ends_at`, `vehicle_id`, `vehicle_label`, `customer_name`, `address`, `notes`, `created_at`, `updated_at`, `deleted_at`
    - Indexes: `(tenant_id, organization_id)`, `(tenant_id, organization_id, starts_at, ends_at)`, `(source_order_id)`
  - `TechnicianReservationTechnician` entity (table: `technician_reservation_technicians`)
    - Fields: `id`, `reservation_id`, `technician_id`, `organization_id`, `tenant_id`, `created_at`, `updated_at`
    - Indexes: `(reservation_id)`, `(technician_id, reservation_id)` UNIQUE, `(tenant_id, organization_id, technician_id)`
- [ ] Run `yarn mercato db generate` to create migration

### 2. Validators (Zod)
- [ ] Create `src/modules/technician_schedule/data/validators.ts`
  - `TechnicianReservationCreateInput` schema
    - Required: `tenantId`, `organizationId`, `reservationType`, `startsAt`, `endsAt`, `technicianIds` (array min 1)
    - Optional: `title`, `sourceOrderId`, `sourceType`, `vehicleId`, `vehicleLabel`, `customerName`, `address`, `notes`
    - Refinement: `endsAt > startsAt`
  - `TechnicianReservationUpdateInput` schema (id required, all other fields optional)
  - `CancelReservationInput` schema (`id`, optional `notes`)

### 3. Overlap Check Helper
- [ ] Create `src/modules/technician_schedule/lib/overlapCheck.ts`
  - Async function injected with `EntityManager` via DI
  - SELECTs `technician_reservation_technicians` JOIN `technician_reservations` per `technicianId`
  - Checks collision in `starts_at..ends_at` window (excludes `cancelled` status)
  - Accepts optional `excludeReservationId` for update scenarios
  - Returns `{ hasConflict: boolean, conflictingTechnicianIds: string[] }`

### 4. Events
- [ ] Create `src/modules/technician_schedule/events.ts`
  - Use `createModuleEvents` with `as const`
  - Declare all 4 events:
    - `technician_schedule.reservation.created`
    - `technician_schedule.reservation.updated`
    - `technician_schedule.reservation.cancelled`
    - `technician_schedule.reservation.conflict_detected`

### 5. Commands
- [ ] Create `src/modules/technician_schedule/commands/reservations.ts`
  - `technician_schedule.reservation.create`
    - Runs overlap check before write
    - Creates `TechnicianReservation` + `TechnicianReservationTechnician` rows atomically in `withAtomicFlush`
    - Captures `before` (null) / `after` snapshot for undo
    - Undo: soft-delete reservation + remove junction rows
  - `technician_schedule.reservation.update`
    - Runs overlap check (excluding current reservation id)
    - Updates reservation fields + replaces junction rows atomically
    - Captures `before` / `after` snapshots
    - Undo: restore previous field values + previous junction rows
  - `technician_schedule.reservation.cancel`
    - Sets `status = 'cancelled'`
    - Captures `before` status for undo
    - Returns 422 if already cancelled
    - Undo: restore previous status
  - `technician_schedule.reservation.delete`
    - Soft-deletes the reservation (`deleted_at`)
    - Captures `before` / `after` snapshot for undo
    - Returns 404 if not found
    - Undo: restore the deleted record and its prior state

### 6. API Routes
- [ ] Create `src/modules/technician_schedule/api/technician-reservations/route.ts`
  - `GET` — paged list with filters: `technicianId`, `reservationType`, `status`, `startsAtFrom`, `startsAtTo`, `sourceOrderId`, `ids`, `sortField`, `sortDir`; embeds `technicians[]` from junction table
  - `POST` — create reservation via command; returns `{ id }` 201; 409 on overlap
  - `PUT` — update reservation via command; 409 on overlap, 404 if not found
  - `DELETE` — soft-delete via delete command; 404 if not found
  - All: `openApi` export, `requireAuth`, `requireFeatures`
- [ ] Create `src/modules/technician_schedule/api/technician-reservations/cancel/route.ts`
  - `POST` — cancel via command; 422 if already cancelled, 404 if not found
  - `openApi` export
- [ ] Create `src/modules/technician_schedule/api/technician-reservations/technicians/route.ts`
  - `GET` — paged list by `reservationId`; `openApi` export

### 7. Subscriber
- [ ] Create `src/modules/technician_schedule/subscribers/onServiceOrderTechnicianAssigned.ts`
  - Export `metadata`: `id`, `event: 'service_orders.service_order.technician_assigned'`, `persistent: true`
  - Logic:
    1. Check if reservation exists with `source_order_id = orderId` and `source_type = 'service_order'`
    2. If exists → execute `reservation.update`
    3. If not → execute `reservation.create`
    4. On overlap → log + emit `technician_schedule.reservation.conflict_detected` (do NOT block)

### 8. DI
- [ ] Create `src/modules/technician_schedule/di.ts`
  - Register `ReservationService` (scoped Awilix)
  - Register `overlapCheck` receiving `em` via DI

### 9. ACL
- [ ] Create `src/modules/technician_schedule/acl.ts`
  - `technician_schedule.view` — default roles: `admin`, `employee`
  - `technician_schedule.manage` — default roles: `admin`

### 10. Setup
- [ ] Create `src/modules/technician_schedule/setup.ts`
  - Tenant init, role feature assignments

### 11. Backend UI — Calendar Page
- [ ] Create `src/modules/technician_schedule/backend/technician-schedule/page.tsx`
  - `ScheduleView` from `@open-mercato/ui/backend/schedule/ScheduleView`
  - Default view: `week`; also supports `month`, `day`, `agenda`
  - Toolbar: technician filter (Select), reservation type filter (multi-select checkboxes), "Add reservation" button
  - Phase 1 scope: standard calendar view with optional technician filter; multi-resource "all technicians simultaneously" grid is deferred to Phase 2
  - Fetch reservations via `apiCall`; map to `ScheduleItem[]`:
    - `id`, `title`, `startsAt`, `endsAt`
    - `kind`: `event` (client_visit) | `availability` (internal_work) | `exception` (leave)
    - `training` maps to `event` and uses `eventPropGetter` for the warning colour override
    - `linkLabel`: "Order" when `source_order_id` is set
  - `onItemClick` → drawer/modal with reservation details:
    - title + reservation type badge
    - status badge
    - date/time range and duration
    - technician list with links to Technician Cards
    - vehicle link when `vehicle_id` is set
    - service order link when `source_order_id` is set
    - customer name, address, notes
    - actions: `Edit` only when `source_type = manual`; `Cancel reservation` via `ConfirmDialog`
  - `onSlotClick` → navigate to `/create` with pre-filled time range
  - Color coding: `training` uses `eventPropGetter` override with `var(--color-warning)`
  - Page states: `LoadingMessage`, `ErrorMessage`, `EmptyState`
- [ ] Create `src/modules/technician_schedule/backend/technician-schedule/page.meta.ts`

### 12. Backend UI — Create Form
- [ ] Create `src/modules/technician_schedule/backend/technician-schedule/create/page.tsx`
  - `CrudForm` with groups:
    - Type: `reservation_type` (Select), status auto-set `confirmed`
    - Time slot: `starts_at`, `ends_at` (DateTimePicker); validate `ends_at > starts_at`
    - Technicians: `technician_ids` (multi-select from active technicians)
    - Vehicle: `vehicle_id` + `vehicle_label` (optional)
    - Trip details: `customer_name`, `address` (optional)
    - Notes: `notes`
  - On save: `flash('Reservation created', 'success')` + redirect to calendar
  - `Cmd/Ctrl+Enter` submit, `Escape` cancel
- [ ] Create `src/modules/technician_schedule/backend/technician-schedule/create/page.meta.ts`

### 13. Module Index
- [ ] Create `src/modules/technician_schedule/index.ts`
  - `id: 'technician_schedule'`
  - Label, icon (lucide-react, no inline SVG)

### 14. i18n
- [ ] Create `src/modules/technician_schedule/i18n/en.json`
  - All user-facing strings: page titles, form labels, status/type labels, flash messages, error messages
- [ ] Create `src/modules/technician_schedule/i18n/pl.json`
  - Polish translations for all keys

### 15. Module Registration
- [ ] Add `{ id: 'technician_schedule', from: '@app' }` to `src/modules.ts`
- [ ] Run `yarn generate` after editing `src/modules.ts`

### 16. Run Migration
- [ ] Confirm migration with user: `yarn mercato db migrate`

---

## Verification Checklist

- [ ] All API routes export `openApi`
- [ ] All routes have `requireAuth` + `requireFeatures` guards
- [ ] All writes wrapped in `withAtomicFlush` (reservation + junction rows atomic)
- [ ] All mutations, including soft-delete, are undoable with `before`/`after` snapshots
- [ ] All events declared in `events.ts` before being emitted
- [ ] Subscriber exports `metadata` with correct shape
- [ ] Overlap check excludes `cancelled` reservations
- [ ] No ORM joins across modules — FK IDs only
- [ ] `pageSize` max 100, default 50
- [ ] No hardcoded hex colors — use CSS variables (`var(--color-warning)`)
- [ ] No `any` types
- [ ] i18n keys cover all user-facing strings in both `en.json` and `pl.json`
- [ ] Reservation detail drawer/modal includes all required fields, links, and gated actions
- [ ] Phase 1 calendar behavior is limited to standard views plus technician filter; multi-resource grid remains out of scope
- [ ] `yarn generate` run after `src/modules.ts` change
- [ ] `yarn mercato db generate` run after entity changes

---

## Implementation Order (Recommended)

```
events.ts → data/entities.ts → db generate → data/validators.ts
→ lib/overlapCheck.ts → di.ts → commands/reservations.ts
→ api/routes → subscribers/ → acl.ts → setup.ts → index.ts
→ backend/pages → i18n → src/modules.ts → yarn generate → db migrate
```

---

## Notes

- `field_technicians` module is already registered and has its own `FieldTechnicianAvailability` (day-level). The new `TechnicianReservation` is a separate semantic layer (time-precise).
- The subscriber fires only when `service_orders` module emits `service_orders.service_order.technician_assigned`. If that event is not present, manual reservations still work.
- Phase 2 (approval flow, multi-resource view, iCal export) is **out of scope** for this implementation.
