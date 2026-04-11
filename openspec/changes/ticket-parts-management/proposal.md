## Why

When a machine is selected on a service ticket, the system shows recommended parts from the machine catalog profile, but the technician cannot act on those recommendations — there is no way to add a recommended part to the ticket with a single click. Parts must be managed through a separate API with no UI. This friction means parts tracking is effectively unused during the hackathon demo.

Additionally, service type is currently a free-choice enum on the ticket, but in practice different machines support different service types (e.g. a CNC machine may need commissioning + maintenance but not warranty_claim). The machine catalog profile already stores `supportedServiceTypes` and part templates already have `service_context`, but nothing connects them — the ticket form ignores both fields. Service type should be driven by the selected machine, and the recommended parts should filter by the chosen service type.

## What Changes

- Add a parts management section to the ticket edit page, showing parts currently attached to the ticket with inline add/edit/remove
- Add a one-click "add to ticket" action on each recommended part displayed in the machine info panel
- When adding a recommended part, pre-fill product reference, quantity, and notes from the catalog part template
- Show the parts list on the ticket detail/edit form so coordinators and technicians see what's needed at a glance
- Filter the service type dropdown on the ticket form to only show types supported by the selected machine (fall back to full enum when no machine is selected)
- Filter recommended parts by the selected service type (using the part template's `service_context` field)
- Display the machine's `supportedServiceTypes` in the machine hints panel

## Capabilities

### New Capabilities
- `ticket-parts-ui`: Inline parts management UI on the ticket edit page — add, edit quantity/notes, remove parts, with one-click add from machine catalog recommendations
- `machine-service-type-filter`: Service type selection driven by machine profile's `supportedServiceTypes`, and part recommendations filtered by selected service type's matching `service_context`

### Modified Capabilities
- `service-tickets`: The ticket edit page gains a parts section and the service type field becomes machine-aware

## Impact

- **UI**: `src/modules/service_tickets/components/` — new parts list component, modifications to `MachineCascadeSelect.tsx` (add-to-ticket buttons, service type list), ticket edit page layout, service type dropdown filtering
- **API**: No API changes needed — existing `/api/service_tickets/parts` CRUD endpoints and `/api/machine_catalog/part-templates` (already supports `serviceContext` filter) are sufficient
- **Data**: No schema/migration changes — `machine_catalog_profiles.supported_service_types` and `machine_catalog_part_templates.service_context` columns already exist. `service_tickets.service_type` column stays (stores the chosen type per ticket).
- **Dependencies**: Reads from `machine_catalog` part templates and machine profiles APIs (already wired in `machineOptions.ts`)
