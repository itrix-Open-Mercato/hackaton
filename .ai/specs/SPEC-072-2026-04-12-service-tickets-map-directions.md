# SPEC-072 — Service Tickets Map: Route Directions & Transport Cost Estimate

**Date**: 2026-04-12
**Status**: Ready

## TLDR

**Key Points:**
- Add a "Get Directions" button inside each ticket marker's info-window popover on the `ServiceTicketsMap` component.
- Clicking the button calculates a driving route from a hardcoded depot/office origin to the ticket's coordinates using the Google Maps Directions API (client-side only — no new backend endpoints).
- A rendered polyline route replaces the plain marker view; a persistent "Reset view" button returns the map to its default state.
- After a route is calculated, the ticket popover (and the active-route header bar) shows an estimated transport cost derived from the **actual driving distance** returned by the Directions API at a fixed rate of **6 PLN/km**.

**Scope:**
- "Get Directions" button in `TicketInfoWindow`
- Route rendering via `DirectionsService` + `DirectionsRenderer` (already bundled with `@react-google-maps/api`)
- Hardcoded origin point stored as a named constant in `src/modules/service_tickets/lib/constants.ts`
- Hardcoded transport rate (`TRANSPORT_RATE_PLN_PER_KM = 6`) in `constants.ts`
- Transport cost shown in the info-window and header bar once a route is active, derived from the driving distance in the `DirectionsResult`
- "Reset view" button rendered in the map header bar, visible only while a route is active
- No new entities, migrations, or API routes

---

## Overview

The service ticket map currently shows ticket locations as clustered markers. Field technicians and dispatchers need to quickly navigate to a job site. Rather than leaving the app to open Google Maps manually, a one-click "Get Directions" action inside the existing info-window popover will render the driving route inline. A "Reset" button returns the map to its normal multi-ticket overview.

> **Market Reference**: Salesforce Field Service and ServiceMax both offer route-to-job-site from within the map view. The pattern adopted here follows Google Maps' own embedded directions pattern: a persistent `DirectionsRenderer` overlay with a reset affordance. We reject turn-by-turn audio or multi-stop optimisation (out of scope).

## Problem Statement

Dispatchers and technicians viewing the ticket map must currently copy the address and switch to a separate navigation app. This breaks the workflow and wastes time. There is no in-app way to visualise the actual driving path from the office to a job site, nor any quick cost estimate to help with trip planning and billing.

## Proposed Solution

Extend `ServiceTicketsMap` (a pure client component) with:

1. **State additions** — `activeRoute: google.maps.DirectionsResult | null` and `routeTargetId: string | null` alongside the existing `selectedId`.
2. **`DirectionsService` call** — on button click, call `new window.google.maps.DirectionsService().route(...)` with `ORIGIN_POINT` → ticket lat/lng, `DRIVING` travel mode.
3. **`DirectionsRenderer`** — rendered inside `<GoogleMap>` when `activeRoute` is set; the renderer draws the polyline and default origin/destination pins.
4. **"Reset view" button** — shown in the map header bar only when a route is active. Clicking it clears `activeRoute` / `routeTargetId`, restores `fitBounds` to all markers.
5. **Hardcoded origin** — `ORIGIN_POINT` constant added to `service_tickets/lib/constants.ts` as `{ lat: number; lng: number }`.
6. **Transport cost estimate** — displayed in every `TicketInfoWindow` popover as soon as it opens. Calculated via the haversine formula (straight-line distance from `ORIGIN_POINT` to ticket coordinates) multiplied by `TRANSPORT_RATE_PLN_PER_KM = 6`. No API call; purely client-side math.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Client-side Directions API only | No server round-trip needed; Google's JS SDK is already loaded. Keeps backend clean. |
| Hardcoded origin as `{ lat, lng }` in `constants.ts` | Format matches Google Maps API natively; no geocoding round-trip needed. |
| `DirectionsRenderer` over custom polyline | Built-in, handles route shaping, traffic colouring, and accessibility labels automatically. |
| Hide all ticket markers while route is active | Cleaner focus — only the `DirectionsRenderer`'s default origin + destination pins are shown. Achieved by gating `<GoogleMarkerClusterer>` render on `!activeRoute`. |
| `useJsApiLoader` needs no change | Directions are part of the core Maps JS API loaded by default; no extra `libraries` array entry required. |
| Driving distance from `DirectionsResult` for cost estimate | Accurate real-road distance already returned by the Directions call the user triggers. No extra API request; the data is free once the route is fetched. Cost is only shown after the user explicitly requests directions. |
| `TRANSPORT_RATE_PLN_PER_KM = 6` in `constants.ts` | Single source of truth, trivial to update. No UI for changing the rate (out of scope). |

## User Stories

- **Dispatcher** wants to **see a driving route from the office to a selected job site** so that they can estimate travel time without leaving the app.
- **Technician** wants to **click "Get Directions" on any ticket marker** so that the route appears instantly on the same map.
- **Dispatcher** wants to **see an estimated transport cost in the ticket popover** so that they can quickly assess trip expense before deciding to dispatch.
- **User** wants to **reset the map to its default multi-ticket view** after inspecting a route so that they can continue browsing other tickets.

## Data Models

No new entities or migrations. All state is ephemeral, held in component-level React state.

## API Contracts

No new backend endpoints. The Google Maps Directions API is called entirely client-side via the Maps JS SDK.

**Client-side call shape** (for documentation):
```
DirectionsService.route({
  origin: ORIGIN_POINT,          // { lat, lng } from constants.ts
  destination: { lat, lng },     // from ServiceTicketMapItem
  travelMode: google.maps.TravelMode.DRIVING,
})
```
Response is a `google.maps.DirectionsResult` stored in component state and passed to `DirectionsRenderer`.

## Implementation Plan

### Phase 1: Constants + directions state

1. Add `ORIGIN_POINT: { lat: number; lng: number }` to `src/modules/service_tickets/lib/constants.ts` with the agreed coordinates.
2. Add `TRANSPORT_RATE_PLN_PER_KM = 6` to `constants.ts` alongside `ORIGIN_POINT`.
3. Add `activeRoute` (`google.maps.DirectionsResult | null`) and `routeTargetId` (`string | null`) to `ServiceTicketsMap` component state (alongside existing `selectedId`).

### Phase 2: Transport cost constants + helper

1. Add `TRANSPORT_RATE_PLN_PER_KM = 6` to `src/modules/service_tickets/lib/constants.ts`.
2. Add a pure helper `drivingCostPln(distanceMeters: number, ratePerKm: number): number`:
   ```ts
   export function drivingCostPln(distanceMeters: number, ratePerKm: number): number {
     return (distanceMeters / 1000) * ratePerKm
   }
   ```
3. Extract driving distance from a `DirectionsResult` via:
   ```ts
   result.routes[0]?.legs[0]?.distance?.value  // meters
   ```
   Store the computed `{ distanceMeters: number; costPln: number }` in a `routeCost` state field on `ServiceTicketsMap` alongside `activeRoute`.

### Phase 3: "Get Directions" button in TicketInfoWindow

1. Add `onGetDirections?: () => void` and `routeCost?: { distanceMeters: number; costPln: number } | null` props to `TicketInfoWindow`.
2. When `routeCost` is provided, render a new row in the info-box detail panel:
   - Label: `service_tickets.map.popup.transportCost` / fallback `"Transport cost"`
   - Value: `{(routeCost.distanceMeters / 1000).toFixed(1)} km · {routeCost.costPln.toFixed(2)} PLN`
3. Render a "Get Directions" button below "Open ticket": label `service_tickets.map.popup.getDirections` / fallback `"Get Directions"`.
4. Wire the button's `onClick` to call `onGetDirections` and close the info-window (`setSelectedId(null)`).
5. Pass `routeCost={routeTargetId === item.id ? routeCost : null}` from `ServiceTicketsMap` — cost is only shown for the ticket whose route is currently active.
6. Add i18n keys `service_tickets.map.popup.getDirections` and `service_tickets.map.popup.transportCost` to `i18n/en.json` and `i18n/pl.json`.

### Phase 4: Directions calculation and rendering

1. In `ServiceTicketsMap`, create a `handleGetDirections(item: ServiceTicketMapItem)` callback:
   - Construct a `DirectionsService` instance (`new window.google.maps.DirectionsService()`).
   - Call `.route({ origin: ORIGIN_POINT, destination: { lat: item.latitude, lng: item.longitude }, travelMode: DRIVING })`.
   - On success: set `activeRoute` to the result, set `routeTargetId` to `item.id`, compute and set `routeCost` using `drivingCostPln(result.routes[0].legs[0].distance.value, TRANSPORT_RATE_PLN_PER_KM)`.
   - On failure: show a flash/toast error (`service_tickets.map.error.directions` / fallback `"Could not calculate route."`).
2. Add `<DirectionsRenderer directions={activeRoute} />` inside `<GoogleMap>`, rendered only when `activeRoute` is non-null.
3. Gate the `<GoogleMarkerClusterer>` block on `!activeRoute` — when a route is shown, all ticket markers are hidden; only the `DirectionsRenderer` origin + destination pins remain.
4. Pass `onGetDirections={() => handleGetDirections(item)}` to the `TicketInfoWindow` rendered in `selectedItem`.

### Phase 5: "Reset view" button

1. Add a `"Reset view"` button (`service_tickets.map.resetView` / fallback `"Reset view"`) to the map header bar (`<div className="px-3 py-2 …">`), rendered only when `activeRoute !== null`. When a route is active, also display the cost summary inline in the header: `{(routeCost.distanceMeters / 1000).toFixed(1)} km · {routeCost.costPln.toFixed(2)} PLN`.
2. On click: clear `activeRoute`, `routeTargetId`, and `routeCost`, then call `map.fitBounds(allMarkersBounds)` to restore the default viewport.
3. Add i18n keys to `i18n/en.json` and `i18n/pl.json`.

### Phase 6: UX polish

1. Disable "Get Directions" button while a directions request is in flight (add `isLoadingRoute` boolean state).
2. If user clicks "Get Directions" on a different ticket while a route is already shown, recalculate immediately and replace the existing route (no explicit reset required).
3. Verify the `fitBounds` effect in the existing `useEffect` does not fire and override the route viewport when `activeRoute` is set (gate it on `!activeRoute`).

## Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| Google Maps Directions API quota exceeded | Medium | Directions API is billed per request; single-tenant hackathon load is negligible. Add error handling to surface quota errors gracefully. | Billing alert should be configured separately. |
| Hardcoded origin becomes stale | Low | Constant is clearly labelled in `constants.ts` with a comment; trivial to update. | None if documented. |
| `DirectionsRenderer` default pins visually clash with custom marker icons | Low | Ticket markers are hidden while a route is active (clusterer gated on `!activeRoute`), so only the renderer's standard A/B pins are visible. No conflict. | None. |
| `fitBounds` effect re-fires and overrides route viewport | Medium | Gate the existing `fitBounds` `useEffect` with `if (activeRoute) return` to prevent it stealing viewport after route render. | None after fix. |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Initial draft |
| 2026-04-12 | Added transport cost estimate feature (driving distance from DirectionsResult × 6 PLN/km, shown in popover and header bar after route is calculated) |
