## Context

InboxOps auto-discovers `inbox-actions.ts` convention files from each enabled module. The CLI generator (`yarn generate`) collects these into `.mercato/generated/inbox-actions.generated.ts`, which the extraction worker and execution engine consume at runtime.

Existing action registrations follow a consistent pattern across sales (`create_order`, `create_quote`), customers (`create_contact`, `log_activity`), and catalog (`create_product`). Each defines `type`, `requiredFeature`, `payloadSchema` (Zod), `promptSchema`, `promptRules`, optional `normalizePayload`, and an `execute` handler.

For entity-creation actions that need human review, the existing pattern uses sessionStorage prefill: the proposal detail page stores the action payload under a module-specific key (e.g., `inbox_ops.orderDraft`), navigates to the target create page with a `fromInboxAction` query param, and the create page reads + merges the prefill data on mount.

The `service_tickets` module currently has no inbox action integration. The ticket create page at `/backend/service-tickets/create` uses a standard `CrudForm` flow with no sessionStorage awareness.

## Goals / Non-Goals

**Goals:**
- Register `create_service_ticket` as a discoverable inbox action using the standard convention file pattern
- Resolve sender email to customer entity (exact match, then domain fallback) and customer machines (serial/code match) in `normalizePayload`
- Provide LLM prompt schema and rules that distinguish service requests from sales inquiries
- Prefill the ticket create form via sessionStorage handoff following the existing `inbox_ops.orderDraft` pattern
- Surface matching discrepancies (unknown sender, ambiguous customer, unresolved machine) in the normalized payload for UI display
- Mark the action as executed after successful ticket creation

**Non-Goals:**
- Auto-creating tickets without human review
- Auto-assigning technicians from email content
- Email threading / conversation tracking on existing tickets
- Modifying the inbox_ops core module
- Schedule/calendar integration from inbox

## Decisions

### 1. Standard convention file registration (not widget injection or DI)

Register via `src/modules/service_tickets/inbox-actions.ts` exporting `inboxActions: InboxActionDefinition[]`.

**Why over alternatives:**
- Widget injection would only handle UI; it can't add LLM prompt rules or server-side normalization
- DI registration would work but bypasses the CLI's auto-discovery and type-safe registry generation
- Convention file is the canonical pattern used by all core modules (sales, customers, catalog)

### 2. `normalizePayload` for customer/machine resolution (not `execute`)

Run customer email matching and machine serial lookup inside `normalizePayload`, which fires before Zod validation and before the action reaches the UI.

**Why:** The resolved `customer_entity_id` and `machine_instance_id` need to be visible in the proposal UI so the operator can verify matches before accepting. If resolution ran only in `execute`, the operator would see raw email/serial strings with no confirmation of what they resolved to.

**Alternative considered:** A separate enrichment hook on the proposal detail page. Rejected because `normalizePayload` already runs per-action and has full DB access via `ctx.container`.

### 3. Prefill-only execute handler (sessionStorage + navigation)

The `execute` handler does NOT auto-create a ticket. Instead, the proposal detail page's `handleEditAction` callback (in inbox_ops core) is extended to recognize `create_service_ticket` and:
1. Write `sessionStorage.setItem('inbox_ops.serviceTicketDraft', JSON.stringify({...}))`
2. Navigate to `/backend/service-tickets/create?fromInboxAction={actionId}`

The ticket create page reads prefill data on mount, merges into form state, and after successful save calls `PATCH /api/inbox_ops/proposals/:proposalId/actions/:actionId` to mark execution.

**Why not auto-create in `execute`:** User explicitly required human review. Service tickets carry operational weight (technician scheduling, parts). The sales module uses this same prefill pattern for `create_order`.

**Why sessionStorage over URL params:** Payload can be large (description, multiple machine hints, discrepancy metadata). URL length limits would truncate. This matches the existing `inbox_ops.orderDraft` / `inbox_ops.productDraft` pattern.

### 4. Cross-module DB queries via Knex (not ORM entity imports)

`normalizePayload` queries `customer_entities`, `customer_companies`, `machine_instances`, and `machine_catalog_profiles` using raw Knex obtained from `ctx.container.resolve('knex')`.

**Why:** CLAUDE.md and AGENTS.md prohibit importing entities across modules (Turbopack CJS async errors). Knex queries are the established cross-module data access pattern.

### 5. Domain matching excludes freemail providers

Customer resolution by domain skips common freemail domains (gmail.com, outlook.com, yahoo.com, etc.) to avoid false matches. Only corporate domains stored in `customer_companies.domain` are matched.

**Why:** A sender at `user@gmail.com` should not match a customer whose employee happens to use `contact@gmail.com`. The spec identifies this as a medium-severity risk.

**Alternative considered:** Match all domains but downweight confidence. Rejected because freemail domains would produce many false positives with low confidence, cluttering proposals.

### 6. Confidence scoring as metadata (not gating)

Confidence is computed and stored in the normalized payload as `_confidence: number` and `_discrepancies: Array<{type, message}>`. It is NOT used to gate whether the action appears — the LLM already decides relevance. Confidence helps the operator assess match quality.

**Why:** The LLM may correctly identify a service email from an unknown sender. Hiding the action due to low matching confidence would defeat the purpose. Instead, the UI shows the confidence level and any discrepancies.

### 7. Action button via widget injection into proposal detail

The "Open Ticket Form" button for `create_service_ticket` actions is added by injecting a widget into the inbox_ops proposal detail page's action card slot. This uses the standard `injection-table.ts` mechanism.

**Why not modify inbox_ops core:** The proposal detail page already dispatches `handleEditAction` by action type. However, the `service_tickets` module is an `@app` module and shouldn't require core changes. Widget injection lets us add the button from our module.

**Alternative considered:** Extending `handleEditAction` in core to support a registry of handlers. This would be cleaner long-term but requires core changes outside our scope.

### 8. Machine catalog context via `promptRules` (not separate context injection)

Rather than a separate LLM context injection mechanism, include machine catalog hints (model codes, families) directly in `promptRules` as a formatted string. The extraction worker already feeds all `promptRules` from the action registry into the LLM system prompt.

**Why:** No new mechanism needed. The extraction prompt already concatenates `promptSchema` + `promptRules` from all registered actions. Adding machine context as a rule keeps it self-contained within the action definition.

**Trade-off:** Catalog context is static per `yarn generate` cycle, not per-extraction. For hackathon scope this is acceptable — machine catalogs don't change frequently.

**Revisit if:** Machine catalog grows beyond ~50 profiles and the prompt becomes too long.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| LLM misclassifies sales emails as service tickets | Medium | `promptRules` explicitly distinguish service vs. sales patterns; human always reviews before ticket creation |
| Domain match returns wrong customer (shared/generic domains) | Medium | Freemail provider exclusion list; ambiguous multi-match flagged as `ambiguous_customer` discrepancy |
| Widget injection slot may not exist on proposal action cards | Medium | Verify slot availability in inbox_ops proposal detail page; fallback to standalone widget if needed |
| `normalizePayload` Knex queries add latency to extraction | Low | Queries hit indexed columns (`primary_email`, `domain`, `customer_company_id`); ~50-100ms per email |
| sessionStorage lost on page refresh during form fill | Low | Standard browser behavior; operator can re-navigate from proposal to re-trigger prefill |
| Machine catalog context grows too large for prompt | Low | Capped at 50 profiles in promptRules; model_code + family only, not full profile details |
| Post-save action marking fails (network error after ticket save) | Low | Ticket is already created; action status can be manually updated; non-blocking to the operator |
