## 1. Module Scaffold

- [x] 1.1 Create `src/modules/technicians/` directory structure (index.ts, acl.ts, setup.ts, lib/constants.ts, data/entities.ts, data/validators.ts, events.ts, types.ts, i18n/en.json, i18n/pl.json)
- [x] 1.2 Register module in `src/modules.ts` as `{ id: 'technicians', from: '@app' }`
- [x] 1.3 Write manual DB migration for technicians, technician_skills, technician_certifications tables

## 2. Data Layer

- [x] 2.1 Define entities: `Technician`, `TechnicianSkill`, `TechnicianCertification` in `data/entities.ts`
- [x] 2.2 Define Zod validators: create/update schemas for technician, skill add/remove, certification add/remove in `data/validators.ts`
- [x] 2.3 Define TypeScript types in `types.ts`

## 3. Commands & API

- [x] 3.1 Implement technician CRUD commands (create, update, delete) in `commands/technicians.ts`
- [x] 3.2 Implement skill management commands (add, remove) in `commands/skills.ts`
- [x] 3.3 Implement certification management commands (add, update, remove) in `commands/certifications.ts`
- [x] 3.4 Create API route `api/technicians/route.ts` with GET (list), POST (create), PUT (update), DELETE
- [x] 3.5 Create API route `api/technicians/[id]/skills/route.ts` for skill add/remove
- [x] 3.6 Create API route `api/technicians/[id]/certifications/route.ts` for certification CRUD
- [x] 3.7 Define OpenAPI schemas in `api/openapi.ts`

## 4. Backend UI — List & Create

- [x] 4.1 Create technician list page at `backend/technicians/page.tsx` with DataTable
- [x] 4.2 Create technician create page at `backend/technicians/create/page.tsx` with CrudForm
- [x] 4.3 Add page.meta.ts files for list and create pages

## 5. Backend UI — Edit/Detail (Karta Serwisanta)

- [x] 5.1 Create technician edit page at `backend/technicians/[id]/edit/page.tsx`
- [x] 5.2 Add skills management section (tag-style add/remove)
- [x] 5.3 Add certifications management section (inline table with add/edit/remove)
- [x] 5.4 Add read-only ticket assignment history section (fetches from service_tickets API)

## 6. Sidebar Navigation

- [x] 6.1 Create sidebar menu injection widget in `widgets/injection/TechnicianMenuItem/widget.ts`
- [x] 6.2 Create `widgets/injection-table.ts` mapping the menu widget to `menu:sidebar:main`

## 7. Service Ticket Integration

- [x] 7.1 Create technician picker component `widgets/injection/TechnicianPicker/widget.tsx` that injects into the service ticket form
- [x] 7.2 Wire picker to fetch active technicians and write selected IDs to `staff_member_ids`

## 8. i18n & Finalization

- [x] 8.1 Add all translation keys to `i18n/en.json` and `i18n/pl.json`
- [x] 8.2 Run `yarn generate` and verify module loads
- [x] 8.3 Run `yarn test` to verify no regressions
