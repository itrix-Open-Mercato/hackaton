# TLDR

This spec converts the business discussion from `/Users/jarekkalasz/Downloads/Meet – psw-rcfb-fsk - Google Chrome - 9 April 2026.srt` into an implementation-ready Open Mercato specification for the business concept "Karta produktu / maszyny".

The transcript makes one thing clear: "machine" is not only a sellable product. It is a two-level operational object:
- a machine template/model
- an installed machine at a customer

Open Mercato MUST model this using a split domain model:
- `catalog` owns the machine product template
- `machine_instances` owns the installed physical machine instance (`egzemplarz`)
- `services` owns service-specific operational context for that installed machine

This spec defines the required catalog-side machine card, how it links to installed machine instances, and how it feeds service planning, technician eligibility, parts suggestions, and machine documentation.

# Overview

## Business Context

The business discussion repeatedly distinguishes between:
- a machine as a product sold by the company
- a machine as a concrete serial-numbered unit installed at the customer

The meeting also highlights that service work depends on machine-specific knowledge stored at the product level:
- machine line/type
- default documentation and manuals
- default parts and service kits
- skill and authorization requirements
- expected service procedures

Technicians need this information before dispatch. Coordinators need it during planning. Management and service teams need a consistent machine inventory view.

## Related Specs

- `SPEC-068-2026-04-10-service-module.md` defines the `services` module and the `service_machine_profiles` extension entity for installed machines.

This spec complements `SPEC-068` by defining the product-template side of the machine model.

Additional source of truth for field design:
- `/Users/jarekkalasz/Downloads/przykladowe_maszyny (1).md`

The sample file provides a concrete field split between:
- product template fields
- installed machine instance (`egzemplarz`) fields
- documentation, inspection cadence, and service-kit structures

# Problem Statement

The transcript uses "produkt", "maszyna", "sprzęt", and "lista maszyn" in overlapping ways. Without a precise Open Mercato model, implementation would drift into one of three failure modes:

1. Treating an installed customer machine as only a catalog product.
2. Treating the machine solely as a generic `resources` row with no product-level service intelligence.
3. Duplicating machine metadata in both `catalog` and `resources` with no authoritative split.

That would break:
- service planning quality
- parts suggestion accuracy
- technician eligibility filtering
- history and installed-base reporting

# Goals

- Define a business-facing machine card that maps cleanly to Open Mercato.
- Keep product template data and installed-instance data separate and authoritative.
- Expose service-relevant machine metadata in a structured, filterable form.
- Reuse `catalog`, `customers`, and `services` where appropriate while introducing a dedicated installed-machine boundary for `egzemplarz`.
- Support future search, reporting, and dispatch automation without schema rewrites.

# Non-Goals

- Building a full PLM or engineering BOM system.
- Replacing warehouse/inventory flows.
- Modeling all manufacturing logistics in phase 1.
- Designing field-service mobile UX in this spec.

# Proposed Solution

## 1. Canonical Two-Level Machine Model

Open Mercato MUST represent machines on two levels:

### Level A — Machine Product Template

Owned by:
- `catalog`

Represents:
- machine family/model sold by the business
- reusable product/service template

Contains:
- machine model metadata
- manuals and service documentation
- default service parts/templates
- required technician capabilities
- standard service parameters

### Level B — Installed Machine Instance

Owned by:
- `machine_instances`
- extended by `services`

Represents:
- the concrete machine installed at a customer site

Contains:
- serial number
- customer ownership
- location
- commissioning/startup date
- warranty status
- next inspection date
- service history

## 2. Technical Placement

This specification introduces one new top-level installed-machine domain module in addition to catalog-side extensions.

Implementation is split across product and installed-base domains:
- `packages/core/src/modules/catalog/` for machine product template features
- `packages/core/src/modules/machine_instances/` for installed machine instances
- `packages/core/src/modules/services/` for customer-machine service context

## 3. Product Card Strategy

The business-facing "Karta produktu / maszyny" SHOULD be implemented as a specialized machine-oriented product detail experience on top of `catalog.product`, not as a separate entity disconnected from catalog.

The machine product card becomes the authoritative definition for:
- what this machine model is
- what documentation applies
- what parts and service kits are typically required
- what technician competencies are needed
- what default inspection/service cadence should be suggested

## 4. Installed Machine Strategy

Installed machines MUST NOT be modeled as generic `resources` rows when `egzemplarz` is intended to live in a dedicated module and database boundary.

Service-specific installed-machine context MUST continue to live in `service_machine_profiles` from `SPEC-068`, with the foreign key pointing to the installed-machine module rather than duplicating catalog data.

# Scope

## In Scope

- machine-specific extension of catalog product detail
- structured machine product metadata
- machine documentation and service template metadata
- linkage from product template to installed machine instances
- use of machine metadata in service planning and service cases
- integration coverage for product-template to installed-machine flows

## Out of Scope

- spare-parts warehouse stock reservation
- manufacturing routing/BOM management
- field telemetry or IoT ingestion
- fleet routing logic
- procurement logic for machine parts

# Architecture

## Reference Patterns

This feature MUST follow:
- `packages/core/src/modules/catalog/AGENTS.md`
- `packages/core/AGENTS.md`
- `SPEC-068-2026-04-10-service-module.md`

## Domain Ownership

### `catalog` owns

- product template identity
- model-level descriptions
- product attachments/media/manuals
- machine service metadata template
- default service kit / part suggestions

### `resources` owns

Nothing in this spec.

Earlier iterations considered `resources` as the installed-machine owner. This is superseded by the clarification that `egzemplarz` will be a separate module/database boundary.

### `machine_instances` owns

- physical installed machine instances
- serial-numbered machine identity
- customer ownership and site assignment
- instance-specific documentation and operational notes
- operational existence of the asset

### `services` owns

- customer-machine service extension fields
- service history
- service case linkage
- warranty/inspection fields required by service operations

## UI Surfaces

Primary surfaces:
- `/backend/catalog/products`
- `/backend/catalog/products/[id]`
- `/backend/machine-instances`
- `/backend/machine-instances/[id]`
- `/backend/customers/companies/[id]` or future v2 detail with assigned machines widget

Expected machine-focused UX additions:
- machine-specific sections on catalog product detail
- installed-base section listing machine instances created from the product template
- machine documentation/service kits section
- service-readiness section with required skills/certifications/languages

## Widget Strategy

Use injection and extension patterns instead of duplicate pages where practical:
- machine installed-base widget on catalog product detail
- machine template summary widget on machine-instance detail
- customer machines widget on customer detail
- machine service history widget on machine-instance detail

# Data Model

## Product Template Modeling

The product template remains `catalog.product`.

Machine-specific structured fields SHOULD NOT live only in generic custom fields. Introduce a first-class extension entity in `catalog`.

### `catalog_machine_profiles`

Purpose:
- structured machine template metadata linked one-to-one with `catalog.product`

Core fields:
- `id`
- `tenant_id`
- `organization_id`
- `product_id`
- `machine_family`
- `model_code` nullable
- `supported_service_types_json`
- `required_skills_json`
- `required_languages_json`
- `required_certifications_json`
- `default_team_size` nullable
- `default_service_duration_minutes` nullable
- `preventive_maintenance_interval_days` nullable
- `default_warranty_months` nullable
- `startup_notes` nullable
- `service_notes` nullable
- `created_at`
- `updated_at`
- `deleted_at`

### `catalog_machine_part_templates`

Purpose:
- default service components, consumables, and machine-specific service kits

Core fields:
- `id`
- `tenant_id`
- `organization_id`
- `machine_profile_id`
- `part_product_id`
- `template_type`
- `service_context`
- `quantity_default`
- `notes` nullable
- `created_at`
- `updated_at`
- `deleted_at`

Suggested `template_type` values:
- `component`
- `consumable`
- `service_kit_item`

Suggested `service_context` values:
- `startup`
- `preventive`
- `repair`
- `reclamation`
- `maintenance_presence`

## Installed Machine Modeling

Installed machines MUST live in a dedicated installed-machine module and table set.

The relationship chain is:
- `catalog.product`
- `catalog_machine_profiles`
- `machine_instances`
- `service_machine_profiles`

`service_machine_profiles` SHOULD include `catalog_product_id` so installed machines always know their source template.

### `machine_instances`

Purpose:
- authoritative installed-machine (`egzemplarz`) master record

Core fields:
- `id`
- `tenant_id`
- `organization_id`
- `catalog_product_id`
- `instance_code`
- `serial_number`
- `customer_company_id`
- `site_name` nullable
- `site_address_snapshot`
- `location_label` nullable
- `contact_name` nullable
- `contact_phone` nullable
- `manufactured_at` nullable
- `commissioned_at` nullable
- `warranty_until` nullable
- `warranty_status`
- `last_inspection_at` nullable
- `next_inspection_at` nullable
- `last_service_case_code` nullable
- `service_count` nullable
- `complaint_count` nullable
- `requires_announcement`
- `announcement_lead_time_hours` nullable
- `instance_notes` nullable
- `is_active`
- `created_at`
- `updated_at`
- `deleted_at`

### `machine_instance_documents`

Purpose:
- files specific to one installed machine instance

Core fields:
- `id`
- `tenant_id`
- `organization_id`
- `machine_instance_id`
- `attachment_id`
- `document_role`
- `title` nullable
- `created_at`
- `updated_at`
- `deleted_at`

Suggested `document_role` values:
- `startup_protocol`
- `annual_inspection`
- `service_protocol`
- `warranty_document`
- `other`

## Field Mapping from Sample Machines

The sample file `/Users/jarekkalasz/Downloads/przykladowe_maszyny (1).md` SHOULD be treated as the reference split for phase 1 field placement.

### Product template fields (`catalog` + `catalog_machine_profiles`)

Belong to product template:
- product code / SKU
- commercial name
- category
- manufacturer / brand
- product line
- technical specification values
- model-level documentation
- inspection schedule template
- default service kits and their lines
- active instance count as derived/read-only summary

### Installed machine fields (`machine_instances`)

Belong to installed machine instance:
- serial number
- Open Mercato instance code
- linked product template
- customer assignment
- address / hall / workstation / roof / room details
- contact person and phone
- manufacturing date
- commissioning/startup date
- warranty until / warranty status
- last inspection / next inspection
- legal inspection dates such as F-GAZ where applicable
- service history counters
- last service request code
- instance-specific documentation
- access / announcement / gate-entry notes
- technician authorization requirement specific to the site or unit

## Data Modeling Rules

- Do not duplicate product-template manuals and default kit definitions into installed-machine master data.
- Use snapshots only where audit/history needs immutable historical context.
- Keep machine template logic structured and filterable.
- Avoid direct ORM relationships across modules; use IDs and extension links.

# API Contracts

## Catalog Extensions

Add machine-specific catalog routes:
- `GET /api/catalog/machine-profiles`
- `POST /api/catalog/machine-profiles`
- `GET /api/catalog/machine-profiles/:id`
- `PUT /api/catalog/machine-profiles/:id`

- `GET /api/catalog/machine-part-templates`
- `POST /api/catalog/machine-part-templates`
- `PUT /api/catalog/machine-part-templates/:id`
- `DELETE /api/catalog/machine-part-templates/:id`

These routes MUST export `openApi`.

## Existing Product Routes

Existing product routes SHOULD be enriched, not replaced.

Product detail responses SHOULD include:
- machine profile summary when the product is machine-typed
- default part/service-kit templates
- installed machine count
- links to recent service activity where available

## Installed Machine Flows

Installed machine creation SHOULD support prefill from the selected machine product template:
- documentation references
- catalog product link
- suggested inspection cadence
- suggested service kit templates

## Service Integration

When a service case selects an installed machine, the planning layer SHOULD be able to consume:
- machine model
- default machine service requirements
- suggested parts/service kit lines
- technician skill/language/certification requirements

# UI Paths Coverage

## Affected Paths

- `/backend/catalog/products`
- `/backend/catalog/products/[id]`
- `/backend/machine-instances/create`
- `/backend/machine-instances/[id]`
- customer detail path with machine widget injection
- service case create/edit/detail pages from `SPEC-068`

## Required UX Capabilities

- identify whether a product is a machine template
- maintain manuals and service documentation at product level
- maintain default parts/service-kit templates at product level
- view all installed machine instances for the template
- jump from installed machine to related service history

# Search

The feature SHOULD extend search coverage for:
- machine family
- model code
- linked catalog product names
- installed machine serial numbers through dedicated machine-instance search

# Migration and Backward Compatibility

## Contract Surfaces Impacted

This is primarily additive:
- new catalog-side machine routes
- new extension entity contracts
- new installed-machine module routes and entities
- enriched existing product detail payloads
- new widgets on product/machine-instance/customer detail pages

## BC Rules

- Existing catalog product routes remain stable.
- Product detail enrichment must be additive.
- Do not repurpose generic product fields to machine-only semantics.
- `machine_instances` remains the canonical installed-machine owner.

# Risks and Impact Review

| Risk | Severity | Affected Area | Mitigation | Residual Risk |
|---|---|---|---|---|
| Machine template and installed machine responsibilities blur together | High | data model | explicit split: template in `catalog`, instance in `machine_instances`, service context in `services` | Medium |
| Service kits are modeled too loosely and become unusable for automation | High | service planning | structured `catalog_machine_part_templates` with typed contexts | Medium |
| Teams duplicate machine docs on installed instances | Medium | content integrity | keep docs authoritative on template; snapshot only when needed | Low |
| Separate instance module/database increases integration complexity | Medium | architecture | use stable IDs, additive APIs, and explicit sync contracts between domains | Medium |
| Machine data becomes inaccessible from customer and service flows | Medium | UX | require widget coverage across catalog/machine-instance/customer/service paths | Low |

# Testing Strategy

## Integration Tests Required

- `TC-MACHINE-001` create machine product template with machine profile and documentation
- `TC-MACHINE-002` add default machine part/service-kit templates to the product
- `TC-MACHINE-003` create installed machine instance linked to machine product template
- `TC-MACHINE-004` installed machine appears on customer-linked machine lists
- `TC-MACHINE-005` service case selection of installed machine surfaces suggested parts and eligibility metadata

## Unit Tests Required

- machine profile validator rules
- machine part template context validation
- product detail enrichment mapper
- installed-base summary calculation
- installed-machine field mapping from sample schema

# Implementation Plan

## Phase 1. Data and API baseline

- add `catalog_machine_profiles`
- add `catalog_machine_part_templates`
- add `machine_instances`
- add `machine_instance_documents`
- implement validators and CRUD routes
- extend product detail response

## Phase 2. Product and instance UX

- add machine-specific product detail sections
- add installed-base widgets
- add machine-instance detail template summary widget

## Phase 3. Service integration

- feed machine template metadata into service planning flows
- surface part suggestions and technician eligibility hints

## Phase 4. Test and rollout

- add unit and integration coverage
- verify additive payload changes
- document operator workflow for machine setup

# Open Questions

1. Should machine-typed products be represented by a dedicated product type enum or by an additive machine-profile presence check?
2. Should manuals and machine documents use existing attachments only, or also support typed document roles such as `manual`, `service_guide`, `startup_checklist`?
3. Should default service kits stay informational in phase 1, or create real service part lines automatically when planning a case?
4. Should `machine_instances` share any infrastructure with generic `resources`, or stay fully independent because it lives in a separate module/database boundary?

# Final Compliance Report

| Rule Source | Requirement | Status | Notes |
|---|---|---|---|
| root `AGENTS.md` | Reuse existing core modules unless business ownership requires a dedicated domain | Pass with exception | `catalog` remains reused; `machine_instances` is introduced because `egzemplarz` is explicitly a separate module/database boundary |
| root `AGENTS.md` | Core platform features belong in `packages/core` | Pass | No app-local module proposed |
| `catalog/AGENTS.md` | Use catalog for products and product-owned logic | Pass | Machine template stays catalog-owned |
| root `AGENTS.md` | No direct ORM relationships across modules | Pass | IDs and extension links only |
| `packages/core/AGENTS.md` | API routes must export `openApi` | Pass | Explicitly required |
| `.ai/specs/AGENTS.md` | Include required spec sections and risk review | Pass | Covered in this document |

# Changelog

## 2026-04-10

- Created implementation-ready machine product card specification based on the April 9 business transcript.
- Defined the authoritative split between machine template, installed machine, and service context.
- Added catalog extension entities, routes, UI coverage, and tests.

## 2026-04-11

- Updated the specification to reflect the clarified requirement that `egzemplarz` lives in a dedicated module/database boundary.
- Replaced `resources` as the installed-machine owner with `machine_instances`.
- Added an explicit field-placement matrix based on `/Users/jarekkalasz/Downloads/przykladowe_maszyny (1).md`.

## Implementation Status

- Spec only
- Not implemented
