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
