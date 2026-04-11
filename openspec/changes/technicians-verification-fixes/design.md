## Context

Post-verification fixes for the technicians module. All issues were identified during `/opsx:verify` against the original specs.

## Goals / Non-Goals

**Goals:**
- Fix all 3 critical issues (skill filter, response enricher, create page)
- Fix key warnings (ticket history filter, picker display)
- Add comprehensive test coverage

**Non-Goals:**
- Resolve staff member name display (requires cross-module data resolution — acceptable as UUID for hackathon)
- Server-side search on list page (client-side filtering is acceptable)

## Decisions

### 1. Skill filter via subquery on technician_skills
The `buildFilters` function will query `technician_skills` for matching skill names and add the resulting technician IDs as an `$in` filter. This avoids ORM joins and stays within the `makeCrudRoute` filter pattern.

### 2. Response enricher pattern
Follow the documented `ResponseEnricher` pattern from `.ai/guides/core.md`. The enricher targets `service_tickets:service_ticket`, fetches assignments + technician profiles for the listed tickets, and returns `_technicians` namespace data.

### 3. Create page — two-phase approach
The create page will first create the technician profile, then redirect to the edit page where skills/certs can be managed. This avoids complex state management on the create form and reuses existing SkillsSection/CertificationsSection components.

### 4. Test structure
- Unit tests: `commands/__tests__/technicians.test.ts`, `data/__tests__/validators.test.ts`
- Integration test: `__integration__/TC-TECHNICIANS-001.spec.ts` following the service_tickets pattern

## Risks / Trade-offs

- Response enricher adds N+1 queries per ticket list load → Mitigated by `enrichMany` batch approach
- Create page redirect means user must save profile before adding skills → Acceptable for hackathon
