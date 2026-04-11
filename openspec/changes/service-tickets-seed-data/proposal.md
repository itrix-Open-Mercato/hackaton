## Why

The service tickets module has no demo data. When presenting the feature, the ticket list is empty and every workflow (filtering, editing, status transitions) must be manually set up. Adding seed data makes the module immediately demonstrable after `yarn initialize`.

## What Changes

- Add `seedExamples` hook to `service_tickets/setup.ts` that creates 8 realistic tickets spanning all statuses, service types, and priorities
- Create `lib/seeds.ts` with declarative seed data and idempotent seeding function
- Seed data cross-references existing seeded entities from core modules: customers (companies + contact people), staff members (technician assignments), and catalog products (placeholder parts)
- Visit dates use relative offsets from "now" so the demo always looks current
- Include staff assignments, parts, and date change history on select tickets

## Capabilities

### New Capabilities

- `ticket-seed-data`: Seed example service tickets with cross-module references (customers, staff, catalog products) for demo/presentation purposes

### Modified Capabilities

- `service-tickets`: Reverses the "No seed data in setup.ts" decision; adds `seedExamples` hook

## Impact

- **Files changed**: `src/modules/service_tickets/setup.ts` (add seedExamples), `src/modules/service_tickets/lib/seeds.ts` (new)
- **Dependencies**: Relies on core module seeds running first (customers, staff, catalog) — this is guaranteed by the framework's module ordering
- **DB tables written**: `service_tickets`, `service_ticket_assignments`, `service_ticket_parts`, `service_ticket_date_changes`
- **No API or schema changes** — seed data uses existing entities directly via EntityManager
