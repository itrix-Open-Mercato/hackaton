# SPEC-070 — Service Ticket Machine Integration

**Date**: 2026-04-11
**Status**: Draft

## TLDR

`feat/machines` introduces two app modules: `machine_instances` for installed customer machines and `machine_catalog` for catalog-side machine service metadata. `agents` already contains a `service_tickets` module with a `machine_asset_id` UUID field, but the current form renders that field as plain text.

The integration should now treat `machine_instances` as the canonical machine source of truth. The recommended shape is to rename the ticket field to `machine_instance_id`, replace the raw UUID input with machine autocomplete, and keep automatic prefill conservative: set customer and address/location from the selected machine, while exposing machine profile defaults and suggested parts as read-only suggestions rather than silently mutating more ticket fields.

## Problem Statement

The two branches currently meet at an incomplete seam:

- `feat/machines` adds a dedicated installed-machine module (`src/modules/machine_instances/`) with customer, site, inspection, warranty, and catalog-product linkage.
- `agents` stores a machine reference on service tickets (`src/modules/service_tickets/data/entities.ts`) but exposes it in the form as a plain text UUID field (`src/modules/service_tickets/components/ticketFormConfig.tsx`).
- `agents` already has a working autocomplete pattern for customer and contact selection (`CustomerCascadeSelect.tsx`), which is the right UI shape to reuse for machines.

Without a deliberate integration contract, merging will leave service tickets technically linkable to machines but not usable in practice.

## Proposed Solution

### Phase 1 — Machine Autocomplete On Service Ticket

Add a `MachineCascadeSelect`-style component to the service-ticket links section that:

- searches `/api/machine-instances/machines`
- shows human-friendly labels built from `instanceCode`, `serialNumber`, `siteName`, and machine model where available
- stores the selected machine UUID on the ticket
- on selection, prefills:
  - `customer_entity_id` from `machine_instances.customer_company_id`
  - `address` from machine site fields when the ticket address is empty

The existing customer/contact cascade stays in place. Machine selection should update customer first, then allow the existing contact picker to narrow to that customer's people.

### Phase 2 — Machine Enrichment For Planning Context

After machine selection works, add non-blocking enrichment that stays assistive rather than auto-mutating:

- resolve `machine_instances.catalog_product_id`
- query `machine_catalog/machine-profiles` by `catalogProductId`
- surface read-only machine metadata on the ticket form/detail:
  - machine family / model code
  - default service duration
  - preventive maintenance interval
  - service notes
- query `machine_catalog/part-templates` for suggested parts or service kits
- present those values as operator guidance or one-click actions, not as automatic writes to ticket fields or ticket part lines

Recommended default:

- auto-fill `customer_entity_id`
- auto-fill address/location only when the current ticket value is empty
- do not auto-fill `contact_person_id`
- do not auto-create ticket part lines
- do not auto-overwrite service timing or priority

This keeps the first integration safe and predictable while still exposing the machine intelligence introduced by `feat/machines`.

### Phase 3 — Naming And API Cleanup

Rename the ticket field from `machine_asset_id` to `machine_instance_id` across:

- entity
- validators
- API query/body schema
- form values
- tests

Recommendation:

- rename now, before the machines branch is integrated into broader service workflows
- keep a temporary API compatibility alias only if needed during the merge window

Reasoning:

- `machine_asset_id` is a carry-over from the older resource/asset framing
- `machine_instance_id` matches the new canonical module and communicates intent clearly
- renaming early avoids long-lived ambiguity once related features, enrichers, and reports start consuming the field

## Data Models

### Existing Machine Data From `feat/machines`

`machine_instances` currently provides:

- `id`
- `catalogProductId`
- `instanceCode`
- `serialNumber`
- `customerCompanyId`
- `siteName`
- `siteAddress`
- `locationLabel`
- `contactName`
- `contactPhone`
- warranty and inspection fields

`machine_catalog` currently provides:

- one profile per catalog product
- service defaults (`defaultTeamSize`, `defaultServiceDurationMinutes`, `preventiveMaintenanceIntervalDays`)
- service notes
- part/service-kit templates

Canonical linkage decision:

- service tickets link to `machine_instances.id`
- `resources` is no longer the long-term machine source of truth for this flow

### Current Gap On `agents`

`service_tickets` currently stores only:

- `machineAssetId?: string | null`

There is no enriched machine label, no autocomplete source, and no derived related-object prefill.

## API Contracts

### Existing APIs We Can Reuse

- `GET /api/machine-instances/machines`
  - already supports `search`, `ids`, and `customerCompanyId`
- `GET /api/machine-catalog/machine-profiles?catalogProductId=<uuid>`
- `GET /api/machine-catalog/part-templates?machineProfileId=<uuid>`

### Additive Contract Recommended For UX

The service-ticket autocomplete will be much simpler if machine list responses add a compact display payload, for example:

```json
{
  "id": "uuid",
  "instance_code": "MI-001",
  "serial_number": "SN-001",
  "customer_company_id": "uuid",
  "site_name": "Factory A",
  "location_label": "Hall B",
  "catalog_product_id": "uuid",
  "_display": {
    "label": "MI-001 • SN-001 • Factory A",
    "customerName": "Customer name",
    "machineModel": "Machine family / model"
  }
}
```

This can be delivered through a response enricher or a dedicated lightweight lookup route.

## Risks

- `machine_instances` stores free-text contact fields (`contactName`, `contactPhone`), not `customers.people` IDs, so ticket `contact_person_id` cannot be safely auto-selected without extra matching logic.
- The current `machine_instances` search only filters by `instance_code`, which is too narrow for a practical autocomplete; serial, site, and customer-aware search likely need to be added.
- Renaming `machine_asset_id` to `machine_instance_id` will require one coordinated pass across entity, validators, APIs, UI, and tests, plus a migration on the integrated branch.
- Merging `feat/machines` into `agents` will at minimum require reconciling `src/modules.ts`, then regenerating module output on the combined branch.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial draft based on `feat/machines` branch research and `agents` service-ticket integration analysis |
