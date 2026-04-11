# Inbox-to-Service-Ticket Integration

**Date**: 2026-04-11
**Status**: Draft

## TLDR

**Key Points:**
- Register `create_service_ticket` as a new InboxOps action type via the existing auto-discovered `inbox-actions.ts` mechanism — no core module changes needed.
- The LLM scores every inbound email for service-ticket relevance using sender→customer matching (domain + exact email), customer→machine ownership, and content signals (complaint language, serial numbers, service type hints).
- "Accept" on the proposed action opens the ticket create form pre-populated with extracted data — human always reviews before save.

**Scope (MVP):**
- `inbox-actions.ts` in `service_tickets` module with `create_service_ticket` action definition
- `normalizePayload` that resolves customer by email/domain and fetches their machines
- LLM `promptSchema` + `promptRules` covering service-ticket field extraction
- Prefill handoff: sessionStorage-based navigation to `/backend/service-tickets/create`
- Discrepancy surfacing: unknown sender, ambiguous machine, missing service type

**Out of scope:**
- Auto-creation of tickets (always human review)
- Auto-assignment of technicians from email content
- Email threading / conversation tracking on existing tickets
- Schedule/calendar integration from inbox (separate concern)

---

## Overview

Service teams receive machine-related requests via email — breakdowns, maintenance scheduling, warranty claims, commissioning requests. Today these emails land in InboxOps as proposals categorized for sales workflows (`create_order`, `create_quote`). The LLM has no concept of service tickets, so service-relevant emails get classified as `complaint` / `inquiry` / `other` with no actionable next step.

This spec adds a `create_service_ticket` action type so the LLM can propose ticket creation when it detects service-relevant content. The proposal surfaces matched customer, machines, inferred service type, and priority — then the operator opens a prefilled form for final review.

> **Market Reference**: Freshdesk and Zendesk both auto-create tickets from email. We adopt the "email → suggestion → human review" model (closer to HubSpot's recommended actions) rather than blind auto-create, because service tickets in our domain carry operational weight (technician scheduling, parts allocation).

## Problem Statement

1. **Service emails are dead-ends**: Emails about machine breakdowns or maintenance requests produce `complaint`/`other` proposals with no action path to the service ticket system.
2. **Manual re-entry**: Operators must read the email, mentally extract customer/machine/issue details, switch to the service ticket module, and manually fill the form — error-prone and slow.
3. **Customer/machine context is lost**: The email sender often maps to a known customer with known machines, but this connection isn't surfaced.

## Proposed Solution

### Architecture

```
Email arrives
    │
    ▼
InboxOps webhook → stores InboxEmail → emits inbox_ops.email.received
    │
    ▼
Extraction worker loads action registry (now includes create_service_ticket)
    │
    ▼
LLM sees service_tickets promptSchema + promptRules
    │  ── also receives: machine catalog context (model codes, serial patterns)
    │
    ▼
LLM proposes create_service_ticket action with payload:
    { service_type, priority, description, customer_email, machine_hints[], ... }
    │
    ▼
normalizePayload resolves:
    sender email → customer_entity_id (exact match or domain match)
    machine_hints → machine_instance_id (serial/model lookup against customer's machines)
    │
    ▼
Proposal shown in InboxOps UI with matched context
    │
    ▼
Operator clicks "Open Ticket Form" → sessionStorage handoff
    │
    ▼
/backend/service-tickets/create reads prefill data and populates form
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Prefill form, never auto-create | User requested. Service tickets have operational consequences (scheduling, parts). Bad auto-created tickets waste technician time. |
| Score all emails, not just complaints | A customer emailing "our CNC 6000 needs the annual checkup" gets classified as `inquiry` or `other`, not `complaint`. Category-gating would miss these. |
| Domain match as baseline, exact email boosts | Companies have many employees. `anyone@acme.com` should match Acme Corp. An exact `primary_email` match adds confidence. |
| Hybrid machine detection (LLM + regex pre-pass) | Regex catches clean serial numbers (`RES-00041`) cheaply. LLM handles fuzzy references ("our HP printer", "the CNC machine"). Regex results are injected into the LLM context as hints. |
| sessionStorage handoff for prefill | Existing pattern used by inbox_ops "Edit" flows for sales documents. No new mechanism needed. |

## User Stories

- **Service dispatcher** wants to **see a "Create Service Ticket" action on emails from known customers about machine issues** so that **they can create a ticket without re-typing the email content**.
- **Service dispatcher** wants to **see which customer and machine the email is about** so that **they can verify the match before creating the ticket**.
- **Service dispatcher** wants to **open the ticket form pre-filled with extracted data** so that **they only need to adjust/confirm fields, not start from scratch**.
- **Service manager** wants to **see discrepancies (unknown sender, ambiguous machine)** so that **they can handle edge cases before creating tickets**.

## Data Models

### No new entities

This integration uses existing entities only:
- `InboxEmail`, `InboxProposal`, `InboxProposalAction` — from inbox_ops (stores the proposed action)
- `ServiceTicket`, `ServiceTicketAssignment` — from service_tickets (created via prefilled form)
- `CustomerEntity`, `CustomerCompanyProfile` — from customers (for sender matching)
- `MachineInstance`, `MachineCatalogProfile` — from machine modules (for machine matching)

### Action Payload Schema (new Zod schema)

```typescript
const createServiceTicketPayloadSchema = z.object({
  // Sender/customer identification
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  customer_entity_id: z.string().uuid().optional(),     // resolved in normalizePayload

  // Machine identification
  machine_hints: z.array(z.string()).optional(),         // raw LLM-extracted: serial numbers, model names
  machine_instance_id: z.string().uuid().optional(),     // resolved in normalizePayload

  // Ticket fields
  service_type: z.enum(['commissioning', 'regular', 'warranty_claim', 'maintenance']).optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  description: z.string().min(1),                        // always extracted — email summary

  // Optional context
  address: z.string().optional(),                        // from email signature or customer record
  contact_person_id: z.string().uuid().optional(),       // resolved if sender is a person-type customer
})
```

## Scoring & Matching Logic

Scoring happens in `normalizePayload` (runs before Zod validation). It enriches the raw LLM payload with resolved entity IDs and a confidence signal.

### Step 1: Customer Resolution

```
Input: customer_email from LLM extraction (sender address)

1. Exact email match:
   SELECT id, kind FROM customer_entities
   WHERE primary_email ILIKE $email
   AND organization_id = $orgId AND deleted_at IS NULL
   → if found: customer_entity_id = match.id, confidence += 0.3

2. Domain match (if no exact match):
   Extract domain from email → e.g., "acme.com"
   SELECT ce.id FROM customer_entities ce
   JOIN customer_companies cc ON cc.entity_id = ce.id
   WHERE cc.domain = $domain
   AND ce.organization_id = $orgId AND ce.deleted_at IS NULL
   → if single match: customer_entity_id = match.id, confidence += 0.15
   → if multiple matches: flag discrepancy "ambiguous_customer", list candidates

3. No match:
   → flag discrepancy "unknown_contact" (same type inbox_ops already uses)
   → leave customer_entity_id empty
```

### Step 2: Machine Resolution

```
Input: machine_hints[] from LLM extraction + customer_entity_id from step 1

1. If customer resolved:
   Fetch all active machines for customer:
   SELECT id, instance_code, serial_number, catalog_product_id
   FROM machine_instances
   WHERE customer_company_id = $customerEntityId
   AND is_active = true AND deleted_at IS NULL

2. Match hints against machines:
   For each hint in machine_hints[]:
     - Exact serial_number match → machine_instance_id, confidence += 0.25
     - Exact instance_code match → machine_instance_id, confidence += 0.25
     - Fuzzy match via catalog profile (model_code, machine_family) → confidence += 0.1
     - No match → flag discrepancy "machine_not_found"

3. If customer has exactly 1 machine and no hints:
   → auto-suggest that machine, confidence += 0.05
   → note: "Customer has only one registered machine"

4. If no customer:
   → skip machine resolution (can't scope the search)
```

### Step 3: Confidence Assembly

The overall action confidence combines LLM confidence with matching signals:

| Signal | Confidence boost |
|--------|-----------------|
| LLM extracted `create_service_ticket` at all | base (LLM's own confidence, 0.0–1.0) |
| Exact customer email match | +0.3 |
| Domain-level customer match | +0.15 |
| Machine serial/code exact match | +0.25 |
| Machine fuzzy match (model/family) | +0.1 |
| Single-machine customer (no hint needed) | +0.05 |

Final confidence = min(1.0, LLM_confidence * 0.5 + matching_signals). The 0.5 weight on LLM confidence prevents over-reliance on the LLM when there's no customer/machine match.

## LLM Integration

### promptSchema

```
create_service_ticket payload:
{ customer_email?: string (sender email), customer_name?: string, machine_hints?: string[] (serial numbers, model codes, or machine descriptions mentioned in the email), service_type?: "commissioning"|"regular"|"warranty_claim"|"maintenance", priority?: "normal"|"urgent"|"critical", description: string (concise summary of the service need — NOT the full email), address?: string (site/location if mentioned) }
```

### promptRules

```typescript
[
  'Propose create_service_ticket when the email describes a machine problem, breakdown, maintenance request, commissioning, warranty issue, or any request for on-site technical service. Do NOT use this for sales inquiries, order requests, or general questions — use create_order/create_quote/log_activity for those.',
  'For create_service_ticket: extract machine_hints as an array of any machine identifiers mentioned — serial numbers, model codes, product names, or informal references (e.g., "our HP printer", "the CNC 6000", "serial RES-00041"). Include all mentions even if uncertain.',
  'For create_service_ticket: infer service_type from context — "warranty" or "guarantee" → warranty_claim; "maintenance" or "annual checkup" or "inspection" → maintenance; "commissioning" or "installation" or "setup" → commissioning; anything else → regular.',
  'For create_service_ticket: infer priority from urgency — "urgent", "ASAP", "production stopped", "safety hazard" → urgent; "critical", "emergency", "danger" → critical; otherwise → normal.',
  'For create_service_ticket: the description should summarize the service need in 1-3 sentences, not copy the entire email. Focus on: what is wrong, which machine, and any time constraints mentioned.',
  'For create_service_ticket: always include customer_email (the sender) and customer_name when available.',
]
```

### Machine Context Injection

To help the LLM match machine references, inject a machine catalog summary into the extraction context (similar to how catalog products are injected today):

```typescript
// In normalizePayload or a pre-extraction enrichment hook
async function fetchMachineContextForExtraction(ctx): Promise<string> {
  // Fetch top N machine catalog profiles for this tenant
  const profiles = await knex('machine_catalog_profiles')
    .join('catalog_products', 'catalog_products.id', 'machine_catalog_profiles.catalog_product_id')
    .where('catalog_products.organization_id', ctx.organizationId)
    .select('catalog_products.title', 'machine_catalog_profiles.model_code',
            'machine_catalog_profiles.machine_family')
    .limit(50)

  return profiles.map(p =>
    `${p.title} (model: ${p.model_code}, family: ${p.machine_family})`
  ).join('\n')
}
```

This context goes into the LLM system prompt alongside existing product catalog data.

## Prefill Handoff Flow

### sessionStorage Contract

When the operator clicks "Open Ticket Form" on the proposal action:

```typescript
// Key: 'inbox_prefill_service_ticket'
// Value: JSON string of:
{
  source: 'inbox_ops',
  proposalId: string,
  actionId: string,
  // Prefilled ticket fields (all optional):
  service_type?: string,
  priority?: string,
  description?: string,
  customer_entity_id?: string,
  contact_person_id?: string,
  machine_instance_id?: string,
  address?: string,
  // Display context (for confirmation, not form fields):
  _customer_name?: string,
  _machine_label?: string,
  _email_subject?: string,
}
```

### Ticket Create Page Changes

The existing create page (`/backend/service-tickets/create`) checks for `sessionStorage.getItem('inbox_prefill_service_ticket')` on mount. If present:
1. Parse the JSON payload
2. Merge into form initial values (only non-empty fields override defaults)
3. Show an info banner: "Pre-filled from email: {subject}" with link back to proposal
4. Remove the sessionStorage key (one-time use)
5. After successful save, mark the inbox action as `executed` with `createdEntityId`

## API Contracts

### No new API endpoints

All integration uses existing endpoints:
- `GET /api/inbox_ops/proposals/:id` — returns proposal with actions (now includes `create_service_ticket` type)
- `POST /api/service_tickets/tickets` — existing ticket creation (called by the form after human review)

### New: Mark action as executed (existing endpoint, new action type)

After the ticket is saved from the prefilled form, the create page calls:

```
POST /api/inbox_ops/proposals/:proposalId/actions/:actionId/execute
```

This existing endpoint looks up the action definition from the generated registry. With `create_service_ticket` registered, it will find our handler. But since we're doing prefill-then-manual-create, the handler needs to accept the already-created ticket ID.

Alternative: after ticket save, call a lighter endpoint to mark the action status:
```
PATCH /api/inbox_ops/proposals/:proposalId/actions/:actionId
Body: { status: 'executed', createdEntityId: ticketId, createdEntityType: 'service_ticket' }
```

This needs investigation — whichever pattern inbox_ops supports for post-hoc action completion.

## Implementation Plan

### Phase 1: Action Registration & LLM Extraction

1. Create `src/modules/service_tickets/inbox-actions.ts` with `create_service_ticket` action definition, payload schema, promptSchema, and promptRules
2. Create payload Zod schema in `src/modules/service_tickets/data/inbox-validators.ts`
3. Implement `normalizePayload` — customer resolution (exact email + domain match), machine resolution, confidence assembly
4. Run `yarn generate` to regenerate inbox action registry
5. Test: send a service-related email → verify LLM proposes `create_service_ticket` action with extracted fields

### Phase 2: Prefill Handoff

6. Add "Open Ticket Form" button to the inbox proposal action card for `create_service_ticket` type — writes sessionStorage and navigates to `/backend/service-tickets/create`
7. Modify ticket create page to read `inbox_prefill_service_ticket` from sessionStorage on mount, merge into form state, show info banner
8. After successful ticket save, mark the inbox action as executed (update action status + `createdEntityId`)
9. Test: full flow from email → proposal → click "Open Ticket Form" → review prefilled form → save → action marked executed

### Phase 3: Machine Context & Discrepancies

10. Add machine catalog context injection into the extraction prompt (model codes, machine families) so LLM can match fuzzy machine references
11. Surface discrepancies in the proposal UI: "unknown sender", "ambiguous customer (N matches)", "machine not found in customer's fleet"
12. Test: email from unknown sender → discrepancy shown; email mentioning machine serial → correct machine resolved

## Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| LLM misclassifies sales email as service ticket | Medium | promptRules explicitly distinguish service vs. sales; human always reviews | Occasional miscategorization — operator rejects and uses correct action |
| Domain match returns wrong customer (shared email domains like gmail.com) | Medium | Only match against `customer_companies.domain`, not freemail providers; flag ambiguous multi-match as discrepancy | Freemail senders get no customer match (discrepancy shown) |
| Machine catalog context bloats LLM prompt (many machines) | Low | Limit to 50 profiles; only include model_code and family, not full details | Large catalogs may truncate — acceptable for hackathon |
| sessionStorage lost on page refresh during form fill | Low | Standard browser behavior; data also visible on proposal page for re-navigation | Operator can re-click "Open Ticket Form" from proposal |
| `normalizePayload` DB queries add latency to extraction | Low | Queries are indexed (primary_email, domain, customer_company_id); runs once per email | ~50-100ms additional extraction time |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Initial spec — skeleton with open questions |
| 2026-04-11 | Full spec after Q&A: prefill-only, score all emails, domain+exact matching, hybrid machine detection |
