@AGENTS.md

## Hackathon Goal

Deliver a **Service Management System** on top of Open Mercato.
Specification source: `~/Downloads/specyfikacja_modulow_v2.docx` (Polish).
Four modules in scope, ordered by priority:

| # | Module | Module ID | Status | Priority |
|---|--------|-----------|--------|----------|
| 2 | Service Ticket (Karta Zgłoszenia) | `service_tickets` | In progress — has P1 bugs | Critical |
| 3 | Technician Card (Karta Serwisanta) | `technicians` (TBD) | Not started | High |
| 4 | Schedule / Calendar (Grafik) | `schedule` (TBD) | Not started | High |
| 7 | Customer Machines (Maszyny Klienta) | `resources` (extension) | Spec written | High |

Key automation: saving a ticket with assigned technician + date auto-creates a schedule reservation.

## Domain Glossary

| Polish (spec) | English | Code identifier |
|---------------|---------|-----------------|
| Zgłoszenie | Service Ticket | `ServiceTicket` / `service_tickets` |
| Karta Zgłoszenia | Ticket Card (detail form) | ticket detail page |
| Serwisant | Technician / Staff | `StaffAssignment` / `staff_member_ids` |
| Karta Serwisanta | Technician Card (profile) | `technicians` module |
| Grafik / Rezerwacja | Schedule / Reservation | `schedule` module |
| Maszyna Klienta | Customer Machine / Asset | `resources` extension |
| Zasób | Resource (installed unit) | `ResourcesResource` |
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
| 1 | P1 | Missing DB migration for service_tickets entities | `data/entities.ts` — run `yarn mercato db generate` |
| 2 | P1 | UTC timestamps fed into `datetime-local` inputs — timezone shift on save | `components/ticketFormConfig.tsx:159-160` |
| 3 | P1 | Duplicate staff IDs accepted → partial writes + 500 | `data/validators.ts:26` |
| 4 | P2 | OpenAPI schema uses snake_case but API returns camelCase | `api/openapi.ts:22-23` |
| 5 | P2 | `visit_date` / `visit_end_date` accept any string, not ISO datetime | `data/validators.ts:19-20` |

## Testing

Tests ensure hackathon speed — catch regressions before they compound.

```bash
yarn test              # Run all unit tests (Jest, ~2s)
yarn test --watch      # Watch mode during development
yarn test -- --testPathPattern=service_tickets  # Run only service_tickets tests
```

- Test location: `src/modules/<id>/**/__tests__/*.test.(ts|tsx)`
- 27 tests exist and pass for `service_tickets` (validators, commands, routes, components)
- Write tests for validators and commands first — they catch the most bugs per minute invested
- Component tests use ts-jest with react-jsx — import from `@testing-library/react` if needed
- Jest moduleNameMapper resolves `@open-mercato/*` to `../open-mercato/packages/*/src/` (local monorepo sibling)

## Module Dependencies

```
Customer Machines (resources ext.)
      │
      ▼
Service Tickets ──────► Schedule/Calendar
      │                      ▲
      ▼                      │
Technician Card ─────────────┘
```

- Tickets reference: customers, resources (machines), staff (technicians), catalog products (parts)
- Schedule entries are created automatically from ticket save (technician + date assigned)
- Technician card feeds skill/availability filters into ticket assignment

## Service Ticket Statuses

`new` → `scheduled` → `in_progress` → `completed`
                                     → `warranty_claim`
                         (any) → `cancelled`

## Service Types

`commissioning` | `regular` | `warranty_claim` | `maintenance`
