# Agent Context Routing — itrix-standalone

**MANDATORY CONTEXT LOADING** — see Critical Rule #5 below.
Before writing code, find your task below and `Read` the listed files.
Do NOT load the entire src/ tree — Open Mercato apps can have many modules.

## What This Project Is

A standalone Open Mercato application built ON TOP of the framework.
The framework lives in `node_modules/@open-mercato/*`. Never edit `node_modules` directly.
Install official packages with `yarn mercato module add @open-mercato/<package>`.
To customise a built-in module beyond extensions, eject with `yarn mercato eject <module>`.

## Local Environment Note

This repo currently uses a hybrid Docker workflow for local development:
- The app is usually run locally with `yarn dev` to avoid slow inner-loop iteration.
- Supporting services commonly stay in Docker, especially PostgreSQL, Redis, and Meilisearch.
- If Docker is also running the full app stack, `localhost:3000` may belong to the Docker app container rather than the local dev server.
- In that setup, agents may use a separate local app port such as `3001` to avoid collisions.
- If PostgreSQL is only exposed inside the Docker network, a host-side proxy on `localhost:5432` may be required for local app processes and test runners.

## Task → Context Map

Match your task below, then **STOP and Read the listed file(s)** before writing
any code. A task may match multiple rows — load all of them. If you skip this
step, you WILL produce incorrect imports and miss required patterns.

### Module Development

| Task | Load |
|---|---|
| Scaffold a new module from scratch | `.ai/skills/module-scaffold/SKILL.md` |
| Design entities and relationships | `.ai/skills/data-model-design/SKILL.md` |
| Build backend UI (forms, tables, pages) | `.ai/skills/backend-ui-design/SKILL.md` |
| Build an integration provider | `.ai/skills/integration-builder/SKILL.md` |

### Extending Core Modules (UMES)

| Task | Load |
|---|---|
| Extend a core module (add fields, columns, menus, interceptors, enrichers) | `.ai/skills/system-extension/SKILL.md` |
| Eject and customize a core module | `.ai/skills/eject-and-customize/SKILL.md` |
| Add a response enricher to another module's API | `.ai/guides/core.md` → Response Enrichers |
| Add an API interceptor (before/after hooks) | `.ai/guides/core.md` → API Interceptors |
| Inject widgets into forms/tables/menus | `.ai/guides/core.md` → Widget Injection |
| Replace or wrap a UI component | `.ai/guides/core.md` → Component Replacement |

### Framework Feature Usage

| Task | Load |
|---|---|
| Add/modify an entity, create migration | `.ai/guides/core.md` → Module Files, then `yarn mercato db generate` |
| Add a REST API endpoint | `.ai/guides/core.md` → API Routes |
| Add a backend page | `.ai/guides/ui.md` → CrudForm / DataTable |
| Add event subscribers or emit events | `.ai/guides/events.md` |
| Add real-time browser updates (SSE) | `.ai/guides/events.md` → DOM Event Bridge |
| Add search to a module | `.ai/guides/search.md` |
| Add caching | `.ai/guides/cache.md` |
| Add background workers | `.ai/guides/queue.md` |
| Use i18n (translations) | `.ai/guides/shared.md` → i18n |
| Use encrypted queries | `.ai/guides/shared.md` → Encryption |
| Use apiCall / UI components | `.ai/guides/ui.md` |
| Add permissions (RBAC) | `.ai/guides/core.md` → Access Control |
| Add notifications | `.ai/guides/core.md` → Notifications |
| Add custom fields | `.ai/guides/core.md` → Custom Fields |

### Quality & Process

| Task | Load |
|---|---|
| Debug / fix errors | `.ai/skills/troubleshooter/SKILL.md` |
| Review code changes | `.ai/skills/code-review/SKILL.md` |
| Write a spec | `.ai/skills/spec-writing/SKILL.md`, `.ai/specs/SPEC-000-template.md` |

## Module Anatomy

Each module in `src/modules/<id>/` is self-contained and auto-discovered:

```
src/modules/<id>/
├── index.ts              # Module metadata
├── data/
│   ├── entities.ts       # MikroORM entity classes
│   ├── validators.ts     # Zod validation schemas
│   ├── extensions.ts     # Cross-module entity links
│   └── enrichers.ts      # Response enrichers
├── api/
│   ├── <resource>/route.ts  # REST handlers (auto-discovered by method)
│   └── interceptors.ts      # API route interception hooks
├── backend/              # Admin UI pages (auto-discovered)
│   └── page.tsx          # → /backend/<module>
├── frontend/             # Public pages (auto-discovered)
├── subscribers/          # Event handlers (export metadata + default handler)
├── workers/              # Background jobs (export metadata + default handler)
├── widgets/
│   ├── injection/        # UI widgets injected into other modules
│   ├── injection-table.ts # Widget-to-slot mappings
│   └── components.ts     # Component replacement/wrapper definitions
├── di.ts                 # Awilix DI registrations
├── acl.ts                # Permission features
├── setup.ts              # Tenant init, role features, seed data
├── events.ts             # Typed event declarations
├── search.ts             # Search indexing configuration
├── ce.ts                 # Custom entities / custom field sets
├── translations.ts       # Translatable fields per entity
├── notifications.ts      # Notification type definitions
└── notifications.client.ts  # Client-side notification renderers
```

Register in `src/modules.ts`: `{ id: '<id>', from: '@app' }`

## CRITICAL rules — always follow without exception

1. **After editing any entity file**: run `yarn mercato db generate` — but see Migration Gotchas in CLAUDE.md: `db generate` is **broken for `@app` modules on Node 24**, so write migrations manually for now
2. **After editing `src/modules.ts`** or any module file: run `yarn generate`
3. **Never edit `.mercato/generated/*`** — auto-generated. Never edit `node_modules/@open-mercato/*` — eject instead.
4. **Confirm migrations with user** before running `yarn mercato db migrate`
5. **BEFORE writing ANY code**, you MUST:
   - Match your task against the **Task → Context Map** above
   - `Read` every file listed in the "Load" column for your task type
   - Only then proceed to implementation
   - If your task matches multiple rows, load ALL listed files
   - **Do NOT skip this step.** The guides contain canonical import paths, required patterns, and conventions that CANNOT be reliably inferred from existing code alone. Skipping leads to wrong imports, missing conventions, and rework.

## Additional Conventions

- Custom modules use `from: '@app'` in `src/modules.ts`
- Sidebar icons MUST use `lucide-react` components — never inline SVG via `React.createElement`
- DataTable MUST wire pagination props (`page`, `pageSize`, `totalCount`, `onPageChange`)
- `pageGroupKey` MUST match across modules for shared sidebar groups. The "Service" group uses `'service_tickets.nav.group'`. Don't invent new keys for modules that belong in the same group.
- Don't combine `page.meta.ts` sidebar registration with widget injection `menu:sidebar:main` — it creates duplicate menu entries. Use one or the other (prefer `page.meta.ts`).

## Machine Integration Learnings

- `machine_instances` is the operational source of truth. Service tickets should store `machine_instance_id`, not `machine_asset_id`.
- `machine_catalog` is supportive domain data. Profile defaults and suggested parts should show up as hints in ticket UX, not automatic writes.
- Selecting a machine on a service ticket should auto-fill customer, and should only fill address/location when the current ticket field is empty.
- Do not auto-fill the contact person from machine selection.
- Machine module REST paths are underscore-based. Use `/api/machine_instances/*` and `/api/machine_catalog/*`, not kebab-case variants.
- Machine UI payloads may arrive as either `snake_case` or `camelCase`; table/detail mappers should tolerate both.
- Sidebar grouping is controlled by `pageGroupKey`, not translated labels. Reuse one shared key if catalog and instances should live under one `Machines` menu.
- When enabling a new module for an existing tenant, backfill ACL features for existing roles or the menu and pages may stay hidden even though the module exists.
- The three canonical machine demo records (`PRD-CNC-6000` / `RES-00041`, `PRD-HP-TM25` / `RES-00089`, `PRD-PRT-LP800` / `RES-00067`) now belong in module `seedExamples`, not manual local DB setup.

## Naming Conventions

- Module IDs: plural, snake_case (`order_items`)
- Event IDs: `module.entity.action` (singular entity, past tense: `sales.order.created`)
- DB tables: plural, snake_case with module prefix (`catalog_products`)
- DB columns: snake_case (`created_at`, `organization_id`)
- JS/TS identifiers: camelCase
- Feature IDs: `<module>.<action>` (`my_module.view`, `my_module.create`)
- UUID primary keys, explicit foreign keys, junction tables for M2M

## Key Imports Quick Reference

```typescript
// Translations
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

// API calls (MUST use — never raw fetch)
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

// CRUD forms
import { CrudForm, createCrud, updateCrud, deleteCrud } from '@open-mercato/ui/backend/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'

// UI components (MUST use — never raw <button>)
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { FormHeader, FormFooter } from '@open-mercato/ui/backend/forms'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

// Encrypted queries (MUST use instead of em.find)
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'

// Events
import { createModuleEvents } from '@open-mercato/shared/modules/events'

// Widget injection
import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'

// Types
import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { ApiInterceptor } from '@open-mercato/shared/lib/crud/api-interceptor'
```

## Key Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Start dev server |
| `yarn generate` | Regenerate `.mercato/generated/` |
| `yarn mercato module add <package>` | Install and enable an official module package |
| `yarn mercato db generate` | Create migration for entity changes |
| `yarn mercato db migrate` | Apply pending migrations |
| `yarn initialize` | Bootstrap DB + first admin account |
| `yarn build` | Build for production |
| `yarn mercato eject <module>` | Copy a core module into `src/modules/` |

## Architecture Rules

- NO direct ORM relationships between modules — use foreign key IDs
- Always filter by `organization_id` for tenant-scoped entities
- Command update/delete handlers MUST filter `em.findOne()` by `tenantId` + `organizationId` — `makeCrudRoute` only auto-scopes list queries and create payloads, not mutations
- Validate all inputs with Zod; derive types via `z.infer`
- Use DI (Awilix) for services; avoid `new`-ing directly
- No `any` types — use Zod schemas with `z.infer`, narrow with runtime checks
- Every dialog: `Cmd/Ctrl+Enter` submit, `Escape` cancel
- Keep `pageSize` at or below 100
- Every API route MUST export `openApi`

## Stack

Next.js App Router, TypeScript, MikroORM, Awilix DI, Zod

## Hackathon Goal

Deliver a **Service Management System** on top of Open Mercato.
Specification source: `~/Downloads/specyfikacja_modulow_v2.docx` (Polish).
Four modules in scope, ordered by priority:

| # | Module | Module ID | Status | Priority |
|---|--------|-----------|--------|----------|
| 2 | Service Ticket (Karta Zgłoszenia) | `service_tickets` | In progress — P1 bugs fixed | Critical |
| 3 | Technician Card (Karta Serwisanta) | `technicians` | In progress | High |
| 4 | Schedule / Calendar (Grafik) | `schedule` (TBD) | Not started | High |
| 7 | Customer Machines (Maszyny Klienta) | `machine_instances` + `machine_catalog` | In progress | High |

Key automation: saving a ticket with assigned technician + date auto-creates a schedule reservation.

## Domain Glossary

| Polish (spec) | English | Code identifier |
|---------------|---------|-----------------|
| Zgłoszenie | Service Ticket | `ServiceTicket` / `service_tickets` |
| Karta Zgłoszenia | Ticket Card (detail form) | ticket detail page |
| Serwisant | Technician / Staff | `StaffAssignment` / `staff_member_ids` |
| Karta Serwisanta | Technician Card (profile) | `technicians` module |
| Grafik / Rezerwacja | Schedule / Reservation | `schedule` module |
| Maszyna Klienta | Customer Machine / Installed Unit | `MachineInstance` / `machine_instances` |
| Profil maszyny | Machine Profile / Catalog Template | `MachineCatalogProfile` / `machine_catalog` |
| Produkt (katalog) | Product (catalogue type) | `CatalogProduct` |
| Typ serwisu | Service Type | `service_type` enum |
| Termin wizyty | Visit Date | `visit_date` / `visit_end_date` |
| Protokół | Work Report / Protocol | attachments |
| Wycena | Quote / Valuation | future feature |
| Podzespoły | Components / Parts | `TicketPart` |
| Umiejętności | Skills (technician tags) | skill filtering |
| Uprawnienia | Certifications | certification entity |
| Delegacja | Business Trip | multi-day reservation |

## Known Bugs — Fix Before New Features

From `reviews/agents-against-main-2026-04-11.md`:

| # | Priority | Issue | File |
|---|----------|-------|------|
| 1 | ~~P1~~ | ~~Missing DB migration for service_tickets entities~~ | Fixed — manual migration written (`migrations/Migration20260411092949_service_tickets.ts`) |
| 2 | ~~P1~~ | ~~UTC timestamps fed into `datetime-local` inputs — timezone shift on save~~ | Fixed — `toDateTimeLocalValue()` converts through `Date` to local string (`components/ticketFormConfig.tsx:37-48`) |
| 3 | ~~P1~~ | ~~Duplicate staff IDs accepted → partial writes + 500~~ | Fixed — `staffMemberIdsSchema` has `.refine()` uniqueness check (`data/validators.ts:27-31`) |
| 4 | ~~P2~~ | ~~OpenAPI schema uses snake_case but API returns camelCase~~ | Fixed — `ticketListItemSchema` uses camelCase (`api/openapi.ts:19-44`) |
| 5 | ~~P2~~ | ~~`visit_date` / `visit_end_date` accept any string, not ISO datetime~~ | Fixed — ISO 8601 regex + `isValidDateTimeToken` refine (`data/validators.ts:15-26`) |

## Testing

Tests ensure hackathon speed — catch regressions before they compound.

```bash
yarn test              # Run all unit tests (Jest, ~2s)
yarn test --watch      # Watch mode during development
yarn test -- --testPathPatterns=service_tickets  # Run only service_tickets tests (NOTE: --testPathPatterns not --testPathPattern)
```

- Test location: `src/modules/<id>/**/__tests__/*.test.(ts|tsx)`
- 20 test suites / 101 tests across `service_tickets`, `technicians`, and `machine_instances`
- Write tests for validators and commands first — they catch the most bugs per minute invested
- Component tests use ts-jest with react-jsx — import from `@testing-library/react` if needed
- Jest moduleNameMapper resolves `@open-mercato/*` to `../open-mercato/packages/*/src/` (local monorepo sibling)
- If that sibling `../open-mercato` checkout is missing in a worktree, Jest can fail before app code runs. Treat that as an environment problem first.
- Machine demo coverage on the mainline track should come from `seedExamples`, so `yarn initialize` yields the 3 sample machines without extra manual SQL.

## Module Dependencies

```
Customer Machines (`machine_catalog` + `machine_instances`)
      │
      ▼
Service Tickets ──────► Schedule/Calendar
      │                      ▲
      ▼                      │
Technician Card ─────────────┘
```

- Tickets reference: customers, machine instances, staff (technicians), catalog products (parts)
- Schedule entries are created automatically from ticket save (technician + date assigned)
- Technician card feeds skill/availability filters into ticket assignment

## Service Ticket Statuses

`new` → `scheduled` → `in_progress` → `completed`
                                     → `warranty_claim`
                         (any) → `cancelled`

## Service Types

`commissioning` | `regular` | `warranty_claim` | `maintenance`
