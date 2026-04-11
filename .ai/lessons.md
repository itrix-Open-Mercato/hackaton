# Lessons Learned

Record patterns, mistakes, and insights discovered during development.
AI agents will update this file as they work on the codebase.

- Service ticket edit flows that use technician assignment widgets must carry `staffMemberIds` through the ticket API response and `TicketFormValues`; without that enrichment the picker cannot pre-select existing assignments or resolve assigned technician details.
- Never feed UTC ISO timestamps directly into HTML `datetime-local` inputs with `.slice(0, 16)`. Convert through `Date` and rebuild the local `YYYY-MM-DDTHH:mm` string first or the saved visit time will shift by timezone.
- In this app, service ticket list responses are normalized to camelCase in `transformItem`, so `ticketListItemSchema` and related OpenAPI tests must validate camelCase payloads rather than raw snake_case DB column names.
- Jest in this workspace may need explicit `moduleNameMapper` entries for app-owned dependencies like `react/jsx-runtime`, `zod`, and `@mikro-orm/*` when tests import sibling monorepo source via `@open-mercato/*` aliases; otherwise suites can fail with false-negative module resolution errors.
