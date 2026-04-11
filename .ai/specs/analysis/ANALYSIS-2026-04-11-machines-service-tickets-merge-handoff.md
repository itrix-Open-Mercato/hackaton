# Analysis — Machines + Service Tickets Merge Handoff

**Date**: 2026-04-11
**Branch at time of writing**: `feat/machines`
**Base branch**: `main`

## TLDR

`feat/machines` has already been rebased onto `main`, where service tickets are merged.

Canonical decisions already made:

- `machine_instances` is the source of truth for machine selection in service tickets
- rename `service_tickets.machine_asset_id` to `machine_instance_id`
- machine selection should:
  - auto-fill `customer_entity_id`
  - auto-fill address/location only if the ticket field is empty
  - not auto-fill `contact_person_id`
  - not auto-create part lines
  - show machine profile defaults and suggested parts as hints / one-click actions, not silent writes

## Branch Findings

### What `feat/machines` adds

Main functional commit:

- `380327f` `feat: add machine modules`

It introduces:

- `src/modules/machine_instances`
- `src/modules/machine_catalog`
- small `resources` extension for `catalogProductId`
- machine integration Playwright tests
- machine-related migrations

### What was already on `main`

`main` now includes merged service-ticket work:

- service ticket module
- service ticket Jest tests
- service ticket integration test

Confirmed commit on `main`:

- `df4afaa` `Merge pull request #1 from itrix-Open-Mercato/feature/service-tickets`

### Rebase result

`feat/machines` is now 2 commits ahead of `main`:

- `380327f` `feat: add machine modules`
- `64ce856` `docs: add machine integration and seed specs`

## Specs Created During Research

These two files were created and committed on this branch:

- [.ai/specs/SPEC-070-2026-04-11-service-ticket-machine-integration.md](/Users/chrustu/.codex/worktrees/814d/hackaton/.ai/specs/SPEC-070-2026-04-11-service-ticket-machine-integration.md)
- [.ai/specs/SPEC-071-2026-04-11-sample-machines-seed-and-domain-shape.md](/Users/chrustu/.codex/worktrees/814d/hackaton/.ai/specs/SPEC-071-2026-04-11-sample-machines-seed-and-domain-shape.md)

Important content from those specs:

- `przykladowe_maszyny.md` was converted into an Open Mercato-style draft spec
- the sample machines should become seed data
- the service-ticket machine field is the main integration seam

## Data Model / Integration Decisions

### Confirmed source of truth

Use `machine_instances.id` as the ticket’s machine reference.

Do not keep `resources` as the long-term source of truth for this flow.

### Field rename

Recommended and accepted:

- rename `machine_asset_id` to `machine_instance_id`

Why:

- `machine_asset_id` reflects the older asset/resources framing
- `machine_instance_id` matches the new canonical domain and avoids long-term ambiguity

### What to prefill on machine selection

Agreed default behavior:

- set `customer_entity_id` from `machine_instances.customer_company_id`
- set ticket address/location only when the current value is empty
- keep `contact_person_id` manual
- surface machine profile data as assistive context, not automatic mutation

Reason:

- safe and predictable for operators
- avoids writing wrong operational data
- still exposes the machine intelligence added by `machine_catalog`

## Important Implementation Findings

### Current service-ticket shape on `main`

Relevant service-ticket files:

- [src/modules/service_tickets/data/entities.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/service_tickets/data/entities.ts)
- [src/modules/service_tickets/api/tickets/route.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/service_tickets/api/tickets/route.ts)
- [src/modules/service_tickets/components/ticketFormConfig.tsx](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/service_tickets/components/ticketFormConfig.tsx)
- [src/modules/service_tickets/components/CustomerCascadeSelect.tsx](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/service_tickets/components/CustomerCascadeSelect.tsx)

Current state:

- tickets already store a machine UUID field
- the form still exposes it as a plain text field
- the customer/contact autocomplete pattern already exists and should be reused

### Current machine module shape on `feat/machines`

Relevant files:

- [src/modules/machine_instances/data/entities.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/machine_instances/data/entities.ts)
- [src/modules/machine_instances/api/machines/route.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/machine_instances/api/machines/route.ts)
- [src/modules/machine_catalog/data/entities.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/machine_catalog/data/entities.ts)
- [src/modules/machine_catalog/api/machine-profiles/route.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/machine_catalog/api/machine-profiles/route.ts)
- [src/modules/machine_catalog/api/part-templates/route.ts](/Users/chrustu/.codex/worktrees/814d/hackaton/src/modules/machine_catalog/api/part-templates/route.ts)

Current machine instance fields include:

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
- warranty / inspection fields
- service counters

Current machine profile data includes:

- machine family / model metadata
- service defaults
- service notes
- part/service-kit templates

## Known Gaps Before Full Integration

### Machine autocomplete API quality

Current issue:

- `machine_instances` search is too narrow for a good autocomplete

Recommended improvement:

- broaden machine search beyond `instance_code`
- include serial number, site, and customer-related matching
- optionally expose a compact `_display` payload or dedicated lookup response

### Contact linkage

Current issue:

- machine instances store free-text `contactName` / `contactPhone`
- service tickets use `contact_person_id` from customers

Consequence:

- `contact_person_id` should not be auto-selected from machine data unless a real customer-person linkage is introduced

## Test / Setup Findings

### Worktree setup

Yes, this project makes sense to set up per worktree.

Reasons:

- branches differ in modules, generated files, migrations, and test setup
- isolated installs reduce branch-to-branch contamination

### What was done in this worktree

Executed:

- `corepack yarn install`
- `corepack yarn generate`

Created:

- `.env`
- `node_modules`
- `.mercato/generated/*`

### Jest test status

Service-ticket Jest suite now passes in this worktree.

Command:

```bash
corepack yarn test:service-tickets
```

Result:

- 8 suites passed
- 27 tests passed

### Why Jest initially failed

Initial blocker:

- `jest.config.cjs` assumed a monorepo sibling checkout at `../open-mercato/...`

In this standalone worktree that path did not exist.

Fix applied locally:

- update Jest path resolution to support either:
  - monorepo sibling sources
  - installed packages under `node_modules/@open-mercato/*`

### Playwright integration status

Integration tests are not yet green in this environment.

Known blockers:

- no app server running on `http://localhost:3000`
- Playwright browser launch is blocked by sandbox/macOS permission constraints in this agent environment

Consequence:

- integration tests are configured, but not fully runnable from this assistant session without a live app runtime and browser permissions

## Test Commands Added Locally

These local changes were added to make test usage more consistent across the merged branch:

- `corepack yarn test:service-tickets`
- `corepack yarn test:machines:integration`
- `corepack yarn test:service-ops`

Related files:

- [package.json](/Users/chrustu/.codex/worktrees/814d/hackaton/package.json)
- [scripts/test-service-ops.mjs](/Users/chrustu/.codex/worktrees/814d/hackaton/scripts/test-service-ops.mjs)
- [jest.config.cjs](/Users/chrustu/.codex/worktrees/814d/hackaton/jest.config.cjs)

These changes are currently local and uncommitted unless committed later.

## Recommended Merge / Implementation Order

1. Rename the service-ticket machine field from `machine_asset_id` to `machine_instance_id`.
2. Replace the raw machine UUID field with machine autocomplete.
3. Hook machine selection to:
   - set customer
   - set empty address/location
4. Add machine profile enrichment as read-only/operator-assistive UI.
5. Improve machine search/display response for autocomplete quality.
6. Only later consider deeper automation like suggested parts becoming real ticket lines.

## Current Local State To Be Aware Of

Committed on branch:

- machine modules
- merge research specs

Local uncommitted changes at the time of this handoff may include:

- `jest.config.cjs`
- `package.json`
- `scripts/test-service-ops.mjs`
- `.ai/qa/test-results/`

Check with:

```bash
git status --short
```

## Recommended Resume Prompt

If starting with empty context, begin from this summary:

> We are on `feat/machines`, already rebased onto `main`. `machine_instances` is the source of truth for machine selection in service tickets. Rename `machine_asset_id` to `machine_instance_id`. Build machine autocomplete into service tickets, auto-fill customer and empty address only, keep contact manual, and show machine profile defaults/suggested parts as hints rather than automatic writes. Use the handoff analysis and SPEC-070 / SPEC-071 as source material.
