# SPEC: Service Tickets Seed Data

**Module**: `service_tickets`
**Date**: 2026-04-11
**Status**: Implementing

## TLDR

Add `seedExamples` to the service_tickets `setup.ts` that creates 8 realistic service tickets across all statuses, service types, and priorities. Tickets reference seeded customers (Brightside Solar, Harborview Analytics, Copperleaf Design Co.), staff members (Alex Chen, Priya Nair, etc.), and catalog products (as placeholder parts). Includes staff assignments, parts, and date change history.

## Cross-module References

**Customers** (seeded by core `customers` module):
- Brightside Solar (company) — Mia Johnson, Daniel Cho (people)
- Harborview Analytics (company) — Arjun Patel, Lena Ortiz (people)
- Copperleaf Design Co. (company) — Taylor Brooks, Naomi Harris (people)
- Lookup: `customer_entities` by `display_name`

**Staff** (seeded by core `staff` module):
- Alex Chen, Priya Nair, Marta Lopez, Samir Haddad, Jordan Kim
- Lookup: `staff_team_members` by `display_name`

**Products** (seeded by core `catalog` module — temporary, see note):
- ATLAS-RUNNER, AURORA-WRAP, SERV-HAIR-60, SERV-MASSAGE-90
- Lookup: `catalog_products` by `sku`
- **NOTE**: Product references are placeholders for machine components. Will migrate to resources module parts when implemented.

## Seed Tickets

| # | Number | Service Type | Status | Priority | Customer | Staff | Parts | Date Changes |
|---|--------|-------------|--------|----------|----------|-------|-------|-------------|
| 1 | SRV-000001 | commissioning | completed | normal | Brightside Solar / Mia Johnson | Alex Chen | 2 | 0 |
| 2 | SRV-000002 | regular | in_progress | normal | Harborview Analytics / Arjun Patel | Priya Nair | 1 | 1 |
| 3 | SRV-000003 | warranty_claim | new | urgent | Copperleaf Design / Naomi Harris | — | 0 | 0 |
| 4 | SRV-000004 | maintenance | scheduled | normal | Brightside Solar / Daniel Cho | Alex Chen, Jordan Kim | 3 | 0 |
| 5 | SRV-000005 | regular | cancelled | normal | Harborview Analytics / Lena Ortiz | — | 0 | 0 |
| 6 | SRV-000006 | commissioning | scheduled | critical | Copperleaf Design / Taylor Brooks | Marta Lopez | 0 | 1 |
| 7 | SRV-000007 | warranty_claim | in_progress | urgent | Brightside Solar / Mia Johnson | Jordan Kim | 1 | 0 |
| 8 | SRV-000008 | maintenance | new | normal | Harborview Analytics / Arjun Patel | — | 0 | 0 |

## Implementation

- **Files**: `lib/seeds.ts` (new), `setup.ts` (modified)
- Visit dates are relative to "now" to keep demo fresh
- Idempotent: skip if any tickets exist in scope
- Uses direct `em.create()` + `em.flush()` (no command layer — avoids auth context)
