## Context

`service_tickets` currently models machine context with a single `machineInstanceId`, which is too narrow for multi-machine visits and forces ticket-level parts, documentation, and technician-fit decisions to be detached from the specific machine they belong to. The change must preserve tenant scoping and avoid cross-module ORM relationships, but it does not need to preserve backward compatibility because the hackathon environment will be reinstalled with fresh data.

This design spans several application concerns: ticket persistence, validation, backend form shape, derived machine context from `machine_instances` and `machine_catalog`, and protocol handoff into `service_protocols`. Because this is a clean-slate data-model change, the design favors a single collection-based contract rather than staged dual-write behavior.

## Goals / Non-Goals

**Goals:**
- Allow one service ticket to reference multiple machine instances with one of them optionally marked as primary inside the new link model.
- Scope planned spare parts, documentation context, and technician requirement warnings to each linked machine.
- Preserve historical readability by snapshotting key machine display and requirement data at ticket time.
- Keep the implementation localized to the `service_tickets` module, using UUID links and query lookups into `machine_instances`, `machine_catalog`, and `service_protocols`.
- Use one collection-based machine contract consistently across storage, APIs, and backend UI.

**Non-Goals:**
- Rebuild the technician domain or introduce hard skill-based assignment blocking.
- Add inventory reservation, route optimization, or scheduling intelligence in this change.
- Preserve the legacy single-machine API or storage contract.
- Introduce cross-module ORM relationships between service tickets and machine/catalog entities.
- Solve document storage architecture beyond linking to existing catalog-backed documentation.

## Decisions

### 1. Use explicit join entities inside `service_tickets`

The source of truth will move away from `ServiceTicket.machineInstanceId` to child entities owned by the `service_tickets` module:
- `ServiceTicketMachine` for ticket-to-machine links
- `ServiceTicketMachinePart` for proposed parts per linked machine
- `ServiceTicketSkillRequirement` for normalized derived requirements

This keeps the domain model expressive enough for per-machine history, parts, and protocol handoff while respecting the project rule that cross-module links are stored as foreign-key IDs only.

Alternatives considered:
- Keep a JSON array on `ServiceTicket`: rejected because parts, skill warnings, and protocol transfer need stable per-machine identity and queryable rows.
- Keep the scalar field as the main model with extensions around it: rejected because it keeps the core limitation alive and adds unnecessary complexity in a fresh-install environment.

### 2. Remove `machineInstanceId` and model primary selection on the link rows

`ServiceTicket.machineInstanceId` should be removed from the service ticket contract, with primary selection represented by `ServiceTicketMachine.isPrimary`. Reads and writes should operate on the ticket-machine collection only, and any UI that needs a primary machine should derive it from the active link rows.

This keeps the domain model consistent and avoids carrying a field whose meaning becomes ambiguous once multiple linked machines exist.

Alternatives considered:
- Keep the field as a mirrored shortcut: rejected because it introduces dual-write drift risk with no practical benefit for a hackathon reset.
- Keep a separate top-level `primaryMachineId`: rejected because `isPrimary` on the link rows already captures the needed concept without duplicating state.

### 3. Snapshot machine context on the link row

Each `ServiceTicketMachine` row should store the key machine display and catalog-derived fields needed for historical readability, including identifiers, labels, site/location text, and requirement snapshots. Reads that need current source-of-truth data may still query upstream modules, but the ticket must remain understandable even if the linked machine or catalog profile changes later.

This design treats ticket-machine rows as a partially denormalized historical record, not just a join table.

Alternatives considered:
- Store only `machine_instance_id` and resolve everything dynamically: rejected because historical tickets would drift when machine/catalog data changes.
- Duplicate the full machine payload: rejected because it would create unnecessary bloat and unclear ownership of mutable data.

### 4. Normalize derived skill requirements instead of recomputing them on every read

The design keeps `required_skills_snapshot` and `required_certifications_snapshot` on the ticket-machine row for auditability, but also materializes `ServiceTicketSkillRequirement` rows for querying, filtering, UI warnings, and later protocol transfer. Requirements are derived from the machine catalog profile when a machine is linked or refreshed.

This avoids repeated JSON parsing and simplifies features such as “show tickets requiring skill X” or “warn when assigned technicians do not match ticket requirements.”

Alternatives considered:
- Use snapshots only: rejected because filtering and deduping across multiple machines becomes awkward and expensive.
- Store only normalized rows: rejected because link-level snapshots are still valuable for debugging and historical context.

### 5. Treat ticket-machine save as a graph synchronization command

Ticket create/update should accept a nested machine payload and synchronize the child graph in one command path:
- validate tenant and organization scope
- validate machine uniqueness within the ticket
- snapshot machine/catalog context
- import template-based proposed parts idempotently
- rebuild derived skill requirements
- enforce that at most one active link is marked as primary

This should happen within one transactional application command so partial updates do not leave mismatched machine links, parts, and requirement state.

Alternatives considered:
- Drive child updates through independent endpoints: rejected because the feature is edited as one ticket form and would be more error-prone under partial failure.
- Use asynchronous event-driven synchronization for requirements/parts: rejected for MVP because it introduces eventual consistency where users expect immediate feedback in the form.

### 6. Keep protocol handoff explicit rather than shared-table reuse

`service_protocols` should receive copied ticket-machine and proposed-part context when a protocol is created from a ticket. The protocol side should not directly reference mutable ticket-machine rows as its live source of truth.

This preserves planned-versus-actual separation and allows a protocol to evolve independently after creation.

Alternatives considered:
- Reference ticket-machine rows directly from protocols: rejected because protocol records must remain stable even if the originating ticket is later edited.
- Delay protocol support to a future change: rejected because the proposal explicitly includes the handoff contract as part of the capability boundary.

### 7. APIs should expose the collection-based machine model directly

Ticket APIs should return a `machineInstances` collection that carries per-link details, planned parts, and requirement context. Request payloads for create/update should use the same nested collection shape, with `isPrimary` identifying the primary machine when one is selected.

This keeps the API aligned with the real domain model and avoids translating between old and new shapes in every handler.

Alternatives considered:
- Return both the old field and the collection: rejected because it duplicates the source of truth and encourages clients to ignore the new model.
- Hide the collection behind a separate endpoint only: rejected because ticket forms and detail views need the full graph as part of normal ticket reads.

## Risks / Trade-offs

- [Historical ticket data may not match the latest machine/catalog state] → Intentionally snapshot display and requirement fields on link rows and treat live upstream lookups as supplemental only.
- [Child graph synchronization can become complex and bug-prone] → Use one transactional command path with deterministic diffing for create, update, soft-delete, and primary-link recalculation.
- [Derived requirements may duplicate data across multiple linked machines] → Keep normalized rows additive for fast querying, and dedupe warning presentation at the ticket level in the read model/UI.
- [The old ticket-level parts model may overlap conceptually with new machine-scoped proposed parts] → Decide explicitly whether ticket-level parts are replaced or reserved for a different use case before implementation starts.
- [Cross-customer machine linking could create confusing ticket ownership] → Default to same-customer validation and require an explicit warning/override flow before accepting mismatched customer context.

## Migration Plan

No in-place migration is planned for this change. The hackathon environment will be reinstalled with fresh data, so implementation can replace the old single-machine model directly instead of backfilling, dual-writing, or preserving rollback behavior for existing records.

## Open Questions

- Should `ServiceTicketPart` be fully replaced by `ServiceTicketMachinePart`, or does ticket-level parts still need to exist for any non-machine-scoped workflow?
- Should cross-customer machine overrides be allowed in MVP with a warning only, or deferred entirely until the business rule is confirmed?
- What exact documentation surfaces are guaranteed to exist in `machine_catalog` for the first release: attachments, URLs, generated manuals, or a mix of them?
