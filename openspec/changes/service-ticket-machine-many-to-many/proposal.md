## Why

The current `service_tickets` model only allows one linked machine per ticket, which breaks down for real service visits that cover multiple installed machines at the same customer site. We need to fix this now because spare-part planning, technician matching, machine history, and later protocol creation all depend on per-machine context that cannot be represented safely with a single `machine_instance_id`.

## What Changes

- Introduce a first-class ticket-to-machine linking model so one service ticket can reference multiple `machine_instances`, while each machine can appear on multiple tickets over time.
- Remove the old single-machine ticket shape and make linked ticket machines the only source of truth for machine context on a service ticket.
- Add per-linked-machine planned spare parts so proposed parts are scoped to the exact machine they apply to instead of the ticket as a whole.
- Surface machine-specific documentation and service context in the ticket flow by resolving machine catalog metadata from the linked machine instance.
- Resolve required skills and certifications from machine catalog profiles and show technician mismatch warnings during ticket assignment without blocking the save flow.
- Define the contract for transferring linked machines and planned machine parts into `service_protocols` when a protocol is created from a ticket.

## Capabilities

### New Capabilities
- `ticket-machine-links`: Service tickets can add, remove, order, and mark a primary machine across multiple linked machine instances using a collection-based machine model.
- `ticket-machine-parts-and-context`: Each linked machine can carry proposed parts, machine-specific documentation shortcuts, and contextual snapshot data needed for ticket review and history.
- `ticket-machine-skill-warnings`: Tickets can derive required skills and certifications from linked machine profiles and warn when assigned technicians do not match those requirements.
- `protocol-machine-transfer`: Creating a service protocol from a ticket carries over linked machines and planned machine parts so protocol work stays traceable per machine.

### Modified Capabilities

## Impact

Affected systems include `service_tickets` data models, validators, commands, REST APIs, backend ticket forms/detail views, and regression tests, plus read-side integrations with `machine_instances`, `machine_catalog`, and `service_protocols`. Implementation will require replacing the old single-machine contract with the new collection-based model and rebuilding fresh app data in the hackathon environment.
