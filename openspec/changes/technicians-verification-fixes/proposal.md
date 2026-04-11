## Why

The technicians module was verified against its specs and 3 critical issues, 5 warnings, and missing test coverage were identified. These must be fixed before the module is production-ready.

## What Changes

- **Fix skill filter in API** — `skill` query param is declared but never applied in `buildFilters`
- **Add response enricher** — service ticket list/detail should display technician names instead of raw UUIDs
- **Fix create page** — add skills and certifications input sections to the create flow
- **Fix ticket history filter** — edit page ticket history section must filter by the technician's staffMemberId
- **Fix technician picker display** — show staff member info instead of truncated UUIDs
- **Add test coverage** — API/integration tests and unit tests for validators, commands, and routes

## Capabilities

### Modified Capabilities
- `technician-profiles`: Fix skill filter in API route buildFilters
- `technician-ticket-assignment`: Add response enricher for technician names on ticket responses; fix picker display
- `technician-detail-page`: Fix create page to include skills/certs; fix ticket history filter

### New Capabilities
- `technician-tests`: Unit tests for validators/commands and integration/API tests for the technicians module

## Impact

- **API**: Skill filter becomes functional; response enricher adds `_technicians` data to ticket responses
- **UI**: Create page gains skills/certs sections; picker shows better labels; ticket history is filtered
- **Tests**: New test files in `src/modules/technicians/__tests__/` and `__integration__/`
