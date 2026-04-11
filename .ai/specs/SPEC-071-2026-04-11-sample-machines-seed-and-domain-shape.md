# SPEC-071 — Sample Machines Seed And Domain Shape

**Date**: 2026-04-11
**Status**: Implemented on mainline follow-up branch

## TLDR

`przykladowe_maszyny.md` describes three representative machine families together with installed customer machines. This document converts that sample into an Open Mercato domain spec: catalog-level machine templates belong to `machine_catalog`, installed customer machines belong to `machine_instances`, and the listed examples should be shipped as seed data so the merged machines/service flow has realistic demo and QA records from day one.

The sample data also clarifies the intended UX boundary: operators work with a product template plus one or more installed machine instances, each tied to a customer, service history, inspection cadence, and operational notes.

## Problem Statement

The source file is rich in business detail but informal in structure. Without converting it into an Open Mercato spec, the team risks:

- losing concrete field examples while implementing generic schemas
- treating sample machines as throwaway notes instead of validation data
- shipping machine and service-ticket flows without realistic records to test autocomplete, prefills, and planning suggestions

## Proposed Solution

Model the sample file using the canonical two-level machine design:

- `machine_catalog` stores the reusable machine template
- `machine_instances` stores the customer-installed unit
- service flows consume `machine_instances` as the source of truth

The three machines from the sample file MUST be represented as seed data:

- product/template seed records
- installed machine seed records
- attachment/document placeholders or references where supported
- service-related counters and warranty/inspection example values where allowed by the module

## Domain Mapping

### Template Level

Each `Produkt` section maps to:

- core catalog product
- one `machine_catalog` profile linked by `catalogProductId`
- zero or more machine part templates for recurring service kits

Template-level data includes:

- product code and commercial name
- category, brand, product line
- technical specification
- manuals and technical documentation
- inspection cadence definitions
- recurring service kit definitions
- active installed-base count

### Installed Machine Level

Each `Zasób` section maps to one `machine_instances` row.

Installed-machine data includes:

- machine instance code / OM resource code equivalent
- serial number
- linked template via `catalogProductId`
- customer assignment
- location and operational placement
- contact details
- production / commissioning / warranty dates
- inspection dates and counters
- service history counters
- operational notes and access requirements

## Seed Data Requirement

The example machines from `przykladowe_maszyny.md` SHOULD be part of app seed data, not just documentation examples.

Required seed coverage:

- `PRD-CNC-6000` with active instance `RES-00041`
- `PRD-HP-TM25` with active instance `RES-00089`
- `PRD-PRT-LP800` with active instance `RES-00067`

Seed data purpose:

- validate machine autocomplete in service tickets
- validate customer-prefill behavior from selected machine
- validate machine profile display on catalog and machine detail pages
- provide stable QA/demo fixtures without hand-entry

If binary attachments are not seeded directly, the seed layer should still create placeholder metadata or deterministic references so the UI shape is exercised.

## Data Models

### Machine Catalog Profile Expectations

The sample file implies the machine profile must support at least:

- machine family / line
- model code or product code
- service cadence metadata
- documentation references
- service notes / startup notes where relevant
- required certifications or operational constraints when applicable

### Machine Part Template Expectations

The sample service kits imply support for:

- grouped kit definitions such as yearly / six-month / head-replacement kits
- template type classification
- service context classification
- part product codes
- quantity and unit

### Machine Instance Expectations

The sample installed machines imply support for:

- `instanceCode`
- `serialNumber`
- `customerCompanyId`
- `siteName`
- `locationLabel`
- `contactName`
- `contactPhone`
- `manufacturedAt`
- `commissionedAt`
- `warrantyUntil`
- `warrantyStatus`
- `lastInspectionAt`
- `nextInspectionAt`
- service counters and latest service case code
- announcement/access notes

## Acceptance Criteria

- [ ] The sample file is represented by a formal Open Mercato spec rather than remaining only an informal markdown note.
- [ ] All three sample machine templates are reflected in seed data design.
- [ ] All three installed machine examples are reflected in seed data design.
- [ ] The seed-data requirement is explicit so QA and demo flows can rely on deterministic machine records.
- [ ] The sample data is aligned with the `machine_catalog` + `machine_instances` ownership split.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Converted `przykladowe_maszyny.md` into an Open Mercato draft spec and added explicit seed-data requirement |
| 2026-04-11 | Implemented machine sample seeding via `machine_catalog.setup.ts` and `machine_instances.setup.ts` `seedExamples` hooks on the mainline follow-up branch |
