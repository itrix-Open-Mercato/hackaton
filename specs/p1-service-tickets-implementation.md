# Plan: Implement `service_tickets` module (P1 — Karta Zgłoszenia)

## Context

Hackathon (Sopot, deadline Sun 12.04 11:00). We're building a field-service management system across 4 parallel modules. This plan covers the `service_tickets` module — the central work-order entity. The full spec is at `.ai/specs/2026-04-10-service-management-system.md`.

Branch: `feat/service-tickets`
Module path: `apps/mercato/src/modules/service_tickets/`

**Important**: Do NOT commit migration files — P4 generates them once all branches merge. Do NOT edit `apps/mercato/src/modules.ts` — P4 handles that at merge time.

---

## Step 1: Module skeleton files

Create these files in `apps/mercato/src/modules/service_tickets/`:

### `index.ts`
```typescript
import './commands/tickets'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'service_tickets',
  title: 'Service Tickets',
  version: '0.1.0',
  description: 'Service ticket management for field service operations.',
  author: 'Open Mercato Team',
  license: 'MIT',
}
```

### `acl.ts`
```typescript
export const features = [
  { id: 'service_tickets.view', title: 'View service tickets', module: 'service_tickets' },
  { id: 'service_tickets.create', title: 'Create service tickets', module: 'service_tickets' },
  { id: 'service_tickets.edit', title: 'Edit service tickets', module: 'service_tickets' },
  { id: 'service_tickets.delete', title: 'Delete service tickets', module: 'service_tickets' },
]
export default features
```

### `setup.ts`
```typescript
import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['service_tickets.*'],
    admin: ['service_tickets.*'],
    employee: ['service_tickets.view', 'service_tickets.create', 'service_tickets.edit'],
  },
}
export default setup
```

### `events.ts`
```typescript
import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'service_tickets.ticket.created', label: 'Ticket Created', entity: 'ticket', category: 'crud' as const, clientBroadcast: true },
  { id: 'service_tickets.ticket.updated', label: 'Ticket Updated', entity: 'ticket', category: 'crud' as const, clientBroadcast: true },
  { id: 'service_tickets.ticket.deleted', label: 'Ticket Deleted', entity: 'ticket', category: 'crud' as const, clientBroadcast: true },
  { id: 'service_tickets.ticket.status_changed', label: 'Ticket Status Changed', entity: 'ticket', category: 'lifecycle' as const, clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'service_tickets', events })
export const emitServiceTicketEvent = eventsConfig.emit
export type ServiceTicketEventId = typeof events[number]['id']
export default eventsConfig
```

### `ce.ts`
```typescript
import type { CustomEntitySpec } from '@open-mercato/shared/modules/entities'
export const entities: CustomEntitySpec[] = []
export default entities
```

---

## Step 2: Data entities

### `data/entities.ts`

4 MikroORM entities following the Todo/CustomerEntity patterns:

- **ServiceTicket** — table `service_tickets`: id, tenant_id, organization_id, ticket_number (text UNIQUE), service_type (text enum), status (text enum, default 'new'), priority (text enum, default 'normal'), description (text nullable), visit_date (timestamptz nullable), visit_end_date (timestamptz nullable), address (text nullable), customer_entity_id (uuid nullable), machine_asset_id (uuid nullable), order_id (uuid nullable), created_by_user_id (uuid nullable), created_at, updated_at, deleted_at
  - Indices: (tenant_id, organization_id), (status, tenant_id, organization_id), (customer_entity_id), (machine_asset_id)

- **ServiceTicketAssignment** — table `service_ticket_assignments`: id, tenant_id, organization_id, ticket_id (ManyToOne→ServiceTicket), staff_member_id (uuid), created_at
  - Indices: UNIQUE(ticket_id, staff_member_id), (staff_member_id)

- **ServiceTicketPart** — table `service_ticket_parts`: id, tenant_id, organization_id, ticket_id (ManyToOne→ServiceTicket), product_id (uuid), quantity (int default 1), notes (text nullable), created_at, updated_at

- **ServiceTicketDateChange** — table `service_ticket_date_changes`: id, tenant_id, organization_id, ticket_id (ManyToOne→ServiceTicket), old_date (timestamptz nullable), new_date (timestamptz nullable), reason (text nullable), changed_by_user_id (uuid nullable), created_at

Pattern reference: `apps/mercato/src/modules/example/data/entities.ts` — follow exact decorator style with `@Entity`, `@PrimaryKey`, `@Property`, `@Index`, `@ManyToOne`, `@Unique`.

### `data/validators.ts`

Zod schemas:
- `serviceTypeSchema` = z.enum(['commissioning', 'regular', 'warranty_claim', 'maintenance'])
- `ticketStatusSchema` = z.enum(['new', 'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled'])
- `ticketPrioritySchema` = z.enum(['normal', 'urgent', 'critical'])
- `ticketCreateSchema` — serviceType, priority (default 'normal'), description?, visitDate?, visitEndDate?, address?, customerEntityId?, machineAssetId?, orderId?, staffMemberIds? (array uuid)
- `ticketUpdateSchema` — id (uuid required), + all above optional
- `ticketListQuerySchema` — id?, ids?, status?, serviceType?, priority?, customerEntityId?, machineAssetId?, search?, visitDateFrom?, visitDateTo?, page, pageSize, sortField, sortDir
- `assignmentCreateSchema` — ticketId, staffMemberId
- `partCreateSchema` — ticketId, productId, quantity (int min 1), notes?
- `partUpdateSchema` — id, quantity?, notes?

---

## Step 3: Commands

### `commands/tickets.ts`

Follow the exact pattern from `apps/mercato/src/modules/example/commands/todos.ts`:

**Create command** (`service_tickets.tickets.create`):
1. Parse input with `parseWithCustomFields(ticketCreateSchema, rawInput)`
2. Generate ticket_number: query max existing `ticket_number` for tenant, increment. Format: `SRV-NNNNNN` (zero-padded 6 digits). Use a simple approach: `SELECT COUNT(*) + 1` with formatting, rely on UNIQUE constraint for safety.
3. Create `ServiceTicket` via `de.createOrmEntity()`
4. If `staffMemberIds` provided → bulk-create `ServiceTicketAssignment` rows
5. Emit `service_tickets.ticket.created` via `emitCrudSideEffects`
6. isUndoable: true (follow undo pattern from todos.ts)

**Update command** (`service_tickets.tickets.update`):
1. Parse input, load existing ticket
2. Apply field changes
3. Sync assignments: delete removed, create added
4. **If visitDate changed** → create `ServiceTicketDateChange` row (old_date from existing, new_date from input, changed_by from ctx.auth.userId)
5. Emit `service_tickets.ticket.updated`
6. If status changed → also emit `service_tickets.ticket.status_changed`

**Delete command** (`service_tickets.tickets.delete`):
1. Soft delete (set deletedAt)
2. Emit `service_tickets.ticket.deleted`

### `commands/parts.ts`
Simple CRUD commands for ServiceTicketPart: `service_tickets.parts.create`, `service_tickets.parts.update`, `service_tickets.parts.delete`.

---

## Step 4: API routes

### `api/openapi.ts`
Copy from `apps/mercato/src/modules/example/api/openapi.ts`, rename tag to `'Service Tickets'`.

### `api/cases/route.ts`
Use `makeCrudRoute` following the exact pattern from `apps/mercato/src/modules/example/api/todos/route.ts`:

- `orm.entity`: ServiceTicket
- `orm.idField`: 'id', `orgField`: 'organizationId', `tenantField`: 'tenantId', `softDeleteField`: 'deletedAt'
- `indexer`: `{ entityType: E.service_tickets.service_ticket }`
- `metadata`: GET requires `service_tickets.view`, POST/PUT/DELETE require respective features
- `list.buildFilters`: handle status, serviceType, priority, customerEntityId, machineAssetId, search (ilike on ticket_number + description), visitDateFrom/To
- `list.sortFieldMap`: ticket_number, status, priority, visit_date, created_at
- `actions.create.commandId`: 'service_tickets.tickets.create'
- `actions.update.commandId`: 'service_tickets.tickets.update'
- `actions.delete.commandId`: 'service_tickets.tickets.delete'

### `api/assignments/route.ts`
Simpler CRUD for assignments. GET lists assignments for a ticket (filter by ticketId). POST creates, DELETE removes.

### `api/parts/route.ts`
CRUD for parts. Filter by ticketId. Commands: `service_tickets.parts.*`.

All routes MUST export `openApi`.

---

## Step 5: Backend pages

### List page — `backend/service-tickets/page.meta.ts` + `page.tsx`

**page.meta.ts**: pageTitle 'Service Tickets', pageTitleKey 'service_tickets.page.title', pageGroup 'Service', pageGroupKey 'service_tickets.nav.group', requireFeatures ['service_tickets.view'], icon (clipboard-list SVG)

**page.tsx**: Server component wrapping `<ServiceTicketsTable />` component.

### `components/ServiceTicketsTable.tsx`

DataTable following `apps/mercato/src/modules/example/components/TodosTable.tsx` pattern:
- Columns: ticket_number, service_type (badge), status (color badge), priority (color badge), customer (name from enrichment or separate query), machine (name), visit_date, created_at
- Filters: status (multi-select), serviceType (multi-select), priority (multi-select), search (text), visitDateFrom/To (date range)
- Row actions: View (→ `/backend/service-tickets/[id]`), Delete (confirm dialog)
- Create button → `/backend/service-tickets/create`

### Create page — `backend/service-tickets/create/page.meta.ts` + `page.tsx`

**page.tsx**: "use client", CrudForm following `apps/mercato/src/modules/example/backend/todos/create/page.tsx` pattern:

Groups:
- **Basic Info** (col 1): serviceType (select), priority (select), description (textarea)
- **Links** (col 2): customerEntityId (text/uuid for now — search-select is stretch goal), machineAssetId (text/uuid), orderId (text/uuid optional)
- **Schedule** (col 1): visitDate (datetime), visitEndDate (datetime), address (text)
- **Technicians** (col 2): staffMemberIds (text — comma-separated UUIDs for v1; multi-select is stretch goal)

On submit: `createCrud('service-tickets/cases', values)`
Success redirect: `/backend/service-tickets?flash=...`

### Detail page — `backend/service-tickets/[id]/page.meta.ts` + `page.tsx`

**page.tsx**: "use client", loads ticket via `fetchCrudList` with `?id=<id>`, displays:
- Header: ticket_number, status badge, priority badge, status-change buttons
- Tab 1 — Overview: all fields, linked customer/machine/order
- Tab 2 — Technicians: list of assignments, add/remove
- Tab 3 — Parts: list of parts with add/edit/remove
- Tab 4 — History: list of ServiceTicketDateChange records

Edit uses `updateCrud('service-tickets/cases', values)`.

---

## Step 6: i18n

### `i18n/en.json`
Keys for: page titles, nav group, form field labels, status/type/priority enum labels, table column headers, button labels, flash messages, validation errors.

### `i18n/pl.json`
Polish translations for all keys. Status names: Nowe, Zaplanowane, W realizacji, Zakończone, Wstrzymane, Anulowane. Types: Uruchomienie, Bieżący, Reklamacja, Utrzymanie. Priorities: Normalny, Pilny, Krytyczny.

---

## Step 7: Seed data (in `setup.ts`)

Add `seedExamples` function:
1. Look up customer entities (query first 3 where kind='company')
2. Look up machine assets by serial `DEMO-SN-*`
3. Look up technician profiles
4. Create 6 tickets (`DEMO-SRV-001` through `006`) — upsert by ticket_number
5. Create assignments and parts for each

---

## Key files to reference during implementation

| Pattern | Reference file |
|---|---|
| Module metadata | `apps/mercato/src/modules/example/index.ts` |
| ACL features | `apps/mercato/src/modules/example/acl.ts` |
| Setup config | `apps/mercato/src/modules/example/setup.ts` |
| Events | `apps/mercato/src/modules/example/events.ts` |
| MikroORM entities | `apps/mercato/src/modules/example/data/entities.ts` |
| Zod validators | `apps/mercato/src/modules/example/data/validators.ts` |
| Command pattern (full) | `apps/mercato/src/modules/example/commands/todos.ts` |
| CRUD route (makeCrudRoute) | `apps/mercato/src/modules/example/api/todos/route.ts` |
| OpenAPI factory | `apps/mercato/src/modules/example/api/openapi.ts` |
| Page metadata | `apps/mercato/src/modules/example/backend/todos/page.meta.ts` |
| DataTable component | `apps/mercato/src/modules/example/components/TodosTable.tsx` |
| CrudForm create page | `apps/mercato/src/modules/example/backend/todos/create/page.tsx` |
| CrudForm edit page | `apps/mercato/src/modules/example/backend/todos/[id]/edit/page.tsx` |
| Customer entity (FK target) | `packages/core/src/modules/customers/data/entities.ts` (CustomerEntity at line 39, table customer_entities) |
| Generated entity IDs | `apps/mercato/.mercato/generated/entities.ids.generated.ts` |

---

## Verification

1. **TypeScript**: `yarn build:packages` should pass with no errors in the module
2. **API smoke test**: After merge + migration, curl:
   - `POST /api/service-tickets/cases` with serviceType + priority → returns `{ id, ticketNumber }`
   - `GET /api/service-tickets/cases` → returns paginated list
   - `PUT /api/service-tickets/cases` with id + status change → returns ok
3. **UI check**: `yarn dev`, navigate to `/backend/service-tickets`:
   - List page renders with DataTable
   - Create page form submits and redirects with flash
   - Detail page loads ticket and shows tabs
4. **Event emission**: Check server logs for `service_tickets.ticket.created` after creating a ticket (P3's subscriber will consume this after merge)
