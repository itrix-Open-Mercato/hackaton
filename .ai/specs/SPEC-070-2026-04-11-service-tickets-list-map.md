# SPEC-070 — Service Tickets List Map

**Date**: 2026-04-11
**Status**: Draft (refreshed to current implementation)

## TLDR

The `service_tickets` module now includes a Google Maps-based map under the backend tickets list. The implementation uses shared filter state, a dedicated `/api/service_tickets/tickets/map` endpoint for marker data, persisted ticket coordinates, and best-effort geocoding on ticket save.

This spec now documents the module as implemented, plus the remaining testing and hardening work needed before we can treat the feature as fully verified.

## Problem Statement

Service coordinators need to understand where reported tickets are concentrated without opening tickets one by one. The original list view exposed only table data, so geographic context was missing even when a service address was present.

The module now addresses that gap by rendering a map directly below the main tickets list and by storing ticket coordinates for reuse across list, map, and future scheduling features.

## Proposed Solution

Use one backend page with two synchronized views of the same ticket filter scope:

- a paginated `DataTable` for CRUD workflows
- a Google Map for spatial overview

The page keeps shared search/filter/pagination state in `useTicketFilters`. The table uses `tableParams`, while the map uses `filterParams` so it can request all matching mapped tickets without inheriting table pagination.

The map is implemented as a client-only component loaded with `next/dynamic(..., { ssr: false })` and rendered below the table through `ServiceTicketsListView`.

## Overview

Current page structure:

- [page.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/backend/service-tickets/page.tsx) renders `ServiceTicketsListView`
- [ServiceTicketsListView.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/components/ServiceTicketsListView.tsx) owns shared filter state and composes table + map
- [ServiceTicketsTable.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/components/ServiceTicketsTable.tsx) renders the paginated CRUD list
- [ServiceTicketsMap.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/components/ServiceTicketsMap.tsx) renders the Google map and marker popups
- [route.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/api/tickets/map/route.ts) returns map marker data and summary counts

Primary user value:

- see all mapped tickets for the active filters on one map
- spot geographic clustering quickly
- open a ticket from its marker popup
- understand how many filtered tickets are missing coordinates

## Design Decisions

| Decision | Current Implementation |
|----------|------------------------|
| Map provider | Google Maps via `@react-google-maps/api` |
| Geocoding provider | Google Geocoding API |
| Map placement | Below the main backend tickets table |
| Shared page state | `useTicketFilters` hook |
| Map transport | Dedicated `GET /api/service_tickets/tickets/map` endpoint |
| Coordinate storage | Persisted on `ServiceTicket` |
| Manual override | Latitude/longitude fields exposed in ticket form |
| Empty map fallback | Poland centroid: `52.07, 19.48` with zoom `6` |
| SSR handling | Map loaded dynamically with `ssr: false` |
| Marker clustering | Not implemented yet |
| Geocoding lifecycle | Best-effort during create/update command execution |
| Geocoding wiring | Module-level singleton `GoogleGeocodingAdapter`, not DI |

## User Stories

- **Service coordinator** wants to **see filtered ticket locations on one map** so that **they can assess field workload geographically**.
- **Dispatcher** wants to **open a ticket from a marker popup** so that **they can act without re-searching**.
- **Operations lead** wants to **see mapped vs. unmapped counts** so that **data-quality gaps are visible**.

## Data Models

### ServiceTicket

Implemented in [entities.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/data/entities.ts).

Location fields:

- `latitude: number | null`
- `longitude: number | null`
- `locationSource: 'geocoded' | 'manual' | null`
- `geocodedAddress: string | null`
- `locationUpdatedAt: Date | null`

Notes:

- `address` remains the editable service-location text field.
- Coordinates are nullable so old tickets remain valid.
- Tenant and organization scoping continue to use the existing `tenantId` and `organizationId`.
- No new cross-module ORM relation was introduced.

Migration:

- [Migration20260411120000_service_tickets_location.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/migrations/Migration20260411120000_service_tickets_location.ts)
- Adds location columns and `st_location_idx`

### ServiceTicketListItem

Implemented in [types.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/types.ts).

The list payload now includes:

- `latitude`
- `longitude`
- `locationSource`
- `geocodedAddress`

### ServiceTicketMapItem

Implemented in [types.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/types.ts) as the read-only map projection:

- `id`
- `ticketNumber`
- `status`
- `serviceType`
- `priority`
- `visitDate`
- `address`
- `latitude`
- `longitude`

### TicketMapResponse

Implemented in [types.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/types.ts):

- `items: ServiceTicketMapItem[]`
- `summary.totalFiltered`
- `summary.mapped`
- `summary.unmapped`
- `summary.cappedAt`
- `summary.truncated`

## API Contracts

### Tickets CRUD list

- `GET /api/service_tickets/tickets`

Current behavior:

- continues to support standard list filters and pagination
- now returns location fields for each row
- remains protected by `service_tickets.view`

Implementation:

- [api/tickets/route.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/api/tickets/route.ts)
- [api/openapi.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/api/openapi.ts)

### Tickets map projection

- `GET /api/service_tickets/tickets/map`

Implemented query filters:

- `status`
- `service_type`
- `priority`
- `search`
- `visit_date_from`
- `visit_date_to`

Behavior:

- requires auth
- scopes by tenant and organization
- returns only tickets with non-null `latitude` and `longitude`
- caps marker items at `2000`
- reports `truncated` and `cappedAt` in summary
- returns `422` for invalid filter payload

Current organization scoping behavior:

- uses `x-organization-id` header when present
- falls back to `auth.orgId`

Current response shape:

```json
{
  "items": [
    {
      "id": "uuid",
      "ticketNumber": "SRV-000001",
      "status": "scheduled",
      "serviceType": "maintenance",
      "priority": "urgent",
      "visitDate": "2026-04-11T09:00:00.000Z",
      "address": "Warsaw, ul. Przykladowa 1",
      "latitude": 52.2297,
      "longitude": 21.0122
    }
  ],
  "summary": {
    "totalFiltered": 24,
    "mapped": 19,
    "unmapped": 5,
    "cappedAt": 2000,
    "truncated": false
  }
}
```

Implementation:

- [api/tickets/map/route.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/api/tickets/map/route.ts)

### Ticket create/update

- `POST /api/service_tickets/tickets`
- `PUT /api/service_tickets/tickets`

Current behavior:

- accepts address plus optional `latitude`, `longitude`, and `location_source`
- supports manual coordinate override through form fields
- geocodes address on create when address exists and manual coords are absent
- re-geocodes on update when address changed and manual coords are absent
- clears location fields when address is explicitly nulled
- does not fail ticket save when geocoding fails

Validation:

- implemented in [validators.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/data/validators.ts)
- latitude and longitude accept numeric values or numeric strings

Command handling:

- implemented in [commands/tickets.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/commands/tickets.ts)

## UI Contracts

### Backend list page

The backend tickets page now renders:

1. the existing ticket table
2. the map directly below it

The map view includes:

- fixed-height map container
- loading state
- fetch-error state
- no-API-key state for missing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- empty state when no mapped tickets match filters
- summary bar with total, mapped, unmapped, and truncation status

### Marker popup

Each marker popup currently shows:

- ticket number
- status
- service type
- visit date
- address
- link to `/backend/service-tickets/[id]/edit`

### Ticket form

The ticket form now includes manual location fields in the schedule group:

- `latitude`
- `longitude`

Implementation:

- [ticketFormConfig.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/components/ticketFormConfig.tsx)

## Acceptance Criteria

- [ ] The backend tickets page renders a table and a map in the same view.
- [ ] The map uses the same active search and filters as the table.
- [ ] The map is loaded client-side only.
- [ ] Marker popups link to the ticket edit page.
- [ ] The map summary always displays total, mapped, and unmapped counts.
- [ ] Missing browser-side API key shows a visible UI error instead of crashing.
- [ ] Geocoding failure does not block ticket save.
- [ ] Manual latitude/longitude entry is supported through the ticket form.
- [ ] Tickets without coordinates do not render markers.
- [ ] The map endpoint remains scoped by auth tenant and organization.

## Implementation Status

Implemented:

- shared filter hook
- list view wrapper
- Google map component
- dedicated map endpoint
- persisted location fields
- manual location migration
- geocoding adapter
- best-effort geocoding in create/update commands
- manual coordinate fields in ticket form
- i18n strings for map UI
- Google Maps package added to `package.json`

Not yet implemented or not yet verified:

- marker clustering
- dedicated automated tests for `useTicketFilters`
- dedicated automated tests for `ServiceTicketsMap`
- dedicated automated tests for `api/tickets/map/route.ts`
- DI registration for geocoding adapter
- shared backend filter helper between list and map routes

## Verification Status

Verification run on 2026-04-11:

### Jest path-pattern run

Command:

```bash
yarn test -- --testPathPattern=service_tickets
```

Result:

- Jest reported `No tests found`
- This did not actually verify the module

### Explicit service_tickets unit test run

Command:

```bash
yarn test -- src/modules/service_tickets/commands/__tests__/tickets.test.ts src/modules/service_tickets/commands/__tests__/parts.test.ts src/modules/service_tickets/api/__tests__/parts.route.test.ts src/modules/service_tickets/api/__tests__/tickets.route.test.ts src/modules/service_tickets/components/__tests__/ticketFormConfig.test.tsx src/modules/service_tickets/components/__tests__/ServiceTicketsTable.test.tsx src/modules/service_tickets/components/__tests__/customerOptions.test.ts src/modules/service_tickets/components/__tests__/CustomerCascadeSelect.test.tsx
```

Result:

- failed

Observed failures:

- most suites fail before execution because Jest cannot resolve `@open-mercato/*` imports into the sibling `../open-mercato` workspace in this environment
- one local assertion is stale:
  - [ticketFormConfig.test.tsx](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/components/__tests__/ticketFormConfig.test.tsx)
  - expected empty form values no longer match because `latitude` and `longitude` were added

### Type-check run

Command:

```bash
yarn typecheck
```

Result:

- failed

Observed failures:

- unrelated upstream errors exist in `node_modules/@open-mercato/core/src/modules/resources/*`
- service-ticket test mocks are also stale:
  - [tickets.test.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/commands/__tests__/tickets.test.ts)
  - [parts.test.ts](/Users/lkurasin/projects/aetryu/hackon/itrix2/src/modules/service_tickets/commands/__tests__/parts.test.ts)
  - mocked `CommandRuntimeContext` no longer satisfies current upstream type because `organizationScope` and `organizationIds` are missing

## Follow-up Plan

1. Repair Jest workspace resolution so the existing `service_tickets` test files can run again.
2. Update stale assertions for `ticketFormConfig` to include latitude/longitude defaults.
3. Update command test mocks to the current `CommandRuntimeContext` shape.
4. Add new tests for:
   - `useTicketFilters`
   - `ServiceTicketsListView`
   - `ServiceTicketsMap`
   - `api/tickets/map/route.ts`
   - geocoding success/failure branches in `commands/tickets.ts`
5. Decide whether to refactor geocoding from a module-level singleton to DI.
6. Decide whether marker clustering is needed before rollout to production-like datasets.

## Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| Geocoding quality is inconsistent for partial addresses | High | Keep coordinates nullable and surface unmapped counts | Some tickets still require manual correction |
| Google geocoding can fail or time out | High | Treat failures as non-fatal and save ticket without coordinates | Map completeness depends on address quality and quota |
| Test harness is currently not reliable for this module | High | Repair Jest/workspace resolution and refresh stale tests before relying on CI | Regressions can slip until tests are restored |
| List and map filter logic can drift | Medium | Extract shared filter helper in a follow-up refactor | Current duplication can diverge over time |
| No clustering for dense marker regions | Medium | Add clustering if real datasets become visually noisy | Dense cities may still be hard to read |
| Module-level geocoder singleton is harder to mock | Medium | Move to DI later if testability or provider swapping becomes more important | Current implementation is simple but less flexible |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial draft for tickets list map |
| 2026-04-11 | Expanded into implementation design for a Google Maps-based list/map view |
| 2026-04-11 | Refreshed to match the current `service_tickets` implementation and recorded real test/typecheck results |
