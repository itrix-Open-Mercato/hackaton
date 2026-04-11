@AGENTS.md

## Scoping Patterns — Read Before Writing Commands

- `ensureScope(ctx)` extracts authenticated `tenantId`/`organizationId` from request context — defined locally in `service_tickets/commands/tickets.ts`, not shared. Copy the pattern into new modules.
- `makeCrudRoute` auto-scopes list queries via `buildScopedWhere`, and injects scope into create payloads via `parseScopedCommandInput`. But update/delete command handlers MUST manually add `tenantId`/`organizationId` to `em.findOne()` filters.
- API list endpoints return snake_case (raw DB columns via `fields` array). Detail endpoints may return camelCase (MikroORM serialization). Handle both casings defensively.

## Reading Code on Other Branches

Use `git show <branch>:<path>` to read files from other branches without switching. Useful for review-based work and cross-branch comparison.

## Migration Gotchas

- `yarn mercato db generate` is **broken for `@app` modules** on Node 24 — tsx loads `@mikro-orm/core` as a separate instance, so `@Entity()` metadata is invisible to the CLI's `MikroORM.init()`. Write migrations manually for now.
- Migration filename pattern: `Migration<YYYYMMDDHHMMSS>_<module_id>.ts`, class: `Migration<YYYYMMDDHHMMSS>_<module_id>`. Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency.
- Failed `db generate` runs leave stray `.ts` files in `node_modules/*/dist/*/migrations/`. These block `db migrate` (Node 24 refuses to type-strip `.ts` inside node_modules). Clean with: `find node_modules/@open-mercato -path "*/dist/*/migrations/Migration*.ts" ! -name "*.d.ts" -delete`
- PostgreSQL runs in Docker. Access via: `docker exec -i $(docker ps --filter "name=postgres" --format '{{.ID}}' | head -1) psql -U postgres -d open-mercato`

## Turbopack / Bundler Gotchas

- **Never import entities across modules** (e.g., `service_tickets/data/entities` from `technicians/data/enrichers`). Turbopack throws "CJS module can't be async". Use raw Knex queries for cross-module DB access instead.
- **`injection-table.ts` must export both named `injectionTable` and `default`** — Turbopack fails without the named export even though generated code tries `default ?? injectionTable`.
- **`enrichers: { entityId }` on `makeCrudRoute`** causes Turbopack CJS async errors in the current Node/Next.js setup. Enrichers are registered globally but can't be activated on routes yet.
- **`z.coerce.boolean()`** treats any non-empty string (including `'false'`) as `true`. Use actual boolean values, not string coercion.

## makeCrudRoute Patterns

- **`afterList` hook must be under `hooks:` at root level**, not inside `list:`. Placing it inside `list:` silently does nothing.
- **Sub-resource routes using `createRequestContainer`** (skills, certifications) don't forward browser auth reliably from client-side `fetch`. Prefer enriching data via the main route's `hooks.afterList` and passing it down.
- **`buildFilters` receives `(query, ctx)` as args** — use `ctx.container.resolve('em')` for subqueries (e.g., filtering technicians by skill name via `technician_skills` table).
- **Staff module API** at `/api/staff/team-members` returns `display_name` (snake_case). Handle both `displayName` and `display_name` in client components.

## Operational Learnings

See `.ai/lessons.md` for patterns and mistakes discovered during development (UTC datetime handling, camelCase normalization, Jest moduleNameMapper quirks, staffMemberIds enrichment). Agents update this file as they work.

## Docker / Local Dev

- Redis runs only inside Docker network (port not exposed to host). `yarn initialize` from host gets ECONNREFUSED on Redis — the Redis errors are non-fatal but noisy.
- Stop the Docker app container before `yarn initialize --reinstall` to avoid "too many clients" PG connection exhaustion: `docker stop hackaton-app-1`
- Restart Docker services to clear stale PG connections: `docker compose restart`
