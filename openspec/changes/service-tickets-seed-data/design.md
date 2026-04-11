## Context

The `service_tickets` module has full CRUD, events, and UI but no seed data. The existing spec explicitly deferred this ("No seed data in setup.ts"). Core modules (customers, staff, catalog) already seed example entities via `seedExamples` hooks — we piggyback on those.

## Goals / Non-Goals

**Goals:**
- 8 tickets covering every status, service type, and priority combination
- Cross-reference seeded customers (companies + people), staff members, and catalog products
- Include staff assignments, parts, and date change audit records on select tickets
- Idempotent: safe to re-run without duplicating data

**Non-Goals:**
- No new entities or schema changes
- No UI changes
- No machine/resource references yet (catalog products used as placeholders)
- No event emission from seed (bypass command layer, write directly via EntityManager)

## Decisions

### Direct EntityManager writes (not command layer)

Commands require auth context (`ctx.auth`, `ctx.container`) that doesn't exist during seeding. Use `em.create()` directly — same pattern as all core module seeds (customers, staff, catalog).

Alternative considered: Constructing a fake CommandRuntimeContext. Rejected — fragile, couples seed to command internals, and unnecessary for static data.

### Idempotency via existence check

Check `em.count(ServiceTicket, { tenantId, organizationId, deletedAt: null })` — if any tickets exist, skip entirely. This is simpler than per-ticket upsert logic and matches the catalog module pattern.

Alternative considered: Per-ticket check by `ticketNumber`. Rejected — over-engineered for seed data that's all-or-nothing.

### Cross-module lookups via raw Knex queries

Look up customers by `display_name`, staff by `display_name`, products by `sku` using Knex on the known table names. This avoids importing entity classes from core modules (which would create coupling). The enricher already uses this pattern for `customer_entities`.

### Relative date offsets

Visit dates defined as day-offsets from "now" (e.g., `-14` = two weeks ago, `+5` = five days out). Normalized to 9:00 AM local. Keeps the demo looking fresh on any day.

## Risks / Trade-offs

- **Core seed data missing** → If customers/staff/catalog seeds haven't run, cross-references silently resolve to `null`. Tickets still seed, just without linked entities. This is acceptable — the module works standalone.
- **Ticket number conflicts** → If user manually created tickets before seeding, `SRV-000001` through `SRV-000008` may collide with the unique constraint. Mitigated by the idempotency check (skip if any tickets exist).
- **Catalog products as part placeholders** → Product SKUs (ATLAS-RUNNER, etc.) don't represent real service parts. Comment in code flags this for future migration to resources module.
