## ADDED Requirements

### Requirement: Inbox action registration

The `service_tickets` module SHALL register a `create_service_ticket` inbox action via an `inbox-actions.ts` convention file. The action definition SHALL include `type`, `requiredFeature`, `payloadSchema`, `promptSchema`, `promptRules`, `normalizePayload`, and `execute`.

Running `yarn generate` SHALL include `create_service_ticket` in the generated inbox action registry at `.mercato/generated/inbox-actions.generated.ts`.

#### Scenario: Action discovered after generation
- **WHEN** `yarn generate` runs with the `service_tickets` module enabled
- **THEN** the generated inbox action registry includes `create_service_ticket`
- **AND** the extraction worker can resolve the action by type

#### Scenario: Action requires RBAC permission
- **WHEN** a user without `service_tickets.create` permission views a proposal with a `create_service_ticket` action
- **THEN** the action button is hidden or disabled

---

### Requirement: Payload schema

The action SHALL define a Zod payload schema accepting:
- `customer_email` (string, email, optional) — sender email for customer resolution
- `customer_name` (string, optional) — sender display name
- `customer_entity_id` (string, UUID, optional) — resolved by `normalizePayload`
- `machine_hints` (array of strings, optional) — raw LLM-extracted machine identifiers
- `machine_instance_id` (string, UUID, optional) — resolved by `normalizePayload`
- `service_type` (enum: `commissioning`, `regular`, `warranty_claim`, `maintenance`, optional)
- `priority` (enum: `normal`, `urgent`, `critical`, default `normal`)
- `description` (string, min 1 character) — email content summary
- `address` (string, optional) — site location if mentioned
- `contact_person_id` (string, UUID, optional) — resolved if sender is a person-type customer

The schema SHALL also accept metadata fields prefixed with `_` that are set by `normalizePayload`:
- `_confidence` (number, 0-1) — overall match confidence
- `_discrepancies` (array of `{type: string, message: string}`) — matching issues
- `_customer_name` (string, optional) — resolved customer display name
- `_machine_label` (string, optional) — resolved machine display label

#### Scenario: Valid payload passes validation
- **WHEN** the LLM produces a payload with `description: "CNC machine breakdown"` and `priority: "urgent"`
- **THEN** the payload passes Zod validation

#### Scenario: Invalid payload rejected
- **WHEN** the LLM produces a payload with an empty `description`
- **THEN** Zod validation fails with a min-length error

#### Scenario: Unknown service type rejected
- **WHEN** the payload contains `service_type: "unknown_type"`
- **THEN** Zod validation fails with an enum error

---

### Requirement: LLM prompt schema and rules

The action SHALL define `promptSchema` describing the payload fields for LLM extraction, and `promptRules` guiding the LLM on when and how to propose `create_service_ticket`.

The `promptRules` SHALL:
1. Instruct the LLM to propose `create_service_ticket` for emails about machine problems, breakdowns, maintenance requests, commissioning, warranty issues, or on-site technical service
2. Explicitly exclude sales inquiries, order requests, and general questions
3. Guide `service_type` inference from email content keywords
4. Guide `priority` inference from urgency signals
5. Instruct extraction of `machine_hints` as an array of any machine identifiers mentioned
6. Instruct `description` to be a 1-3 sentence summary, not the full email

#### Scenario: Service-relevant email triggers proposal
- **WHEN** the LLM processes an email saying "Our CNC 6000 broke down, production is stopped"
- **THEN** the LLM proposes `create_service_ticket` with `service_type: "regular"`, `priority: "urgent"`, and `machine_hints: ["CNC 6000"]`

#### Scenario: Sales email does not trigger proposal
- **WHEN** the LLM processes an email saying "We'd like to order 50 units of product X"
- **THEN** the LLM does NOT propose `create_service_ticket`

#### Scenario: Warranty email infers correct type
- **WHEN** the LLM processes an email mentioning "warranty claim" or "guarantee"
- **THEN** the extracted `service_type` is `warranty_claim`

#### Scenario: Maintenance email infers correct type
- **WHEN** the LLM processes an email mentioning "annual checkup" or "scheduled maintenance"
- **THEN** the extracted `service_type` is `maintenance`

---

### Requirement: Customer resolution in normalizePayload

The `normalizePayload` function SHALL resolve the sender email to a customer entity using cross-module Knex queries (no ORM entity imports).

Resolution order:
1. Exact email match: query `customer_entities` where `primary_email` ILIKE the sender email, scoped by `organization_id` and `deleted_at IS NULL`
2. Domain match (if no exact match): extract domain from email, skip freemail providers (gmail.com, outlook.com, yahoo.com, hotmail.com, etc.), query `customer_companies` by `domain` joined to `customer_entities`
3. No match: flag `unknown_contact` discrepancy, leave `customer_entity_id` empty

#### Scenario: Exact email match
- **WHEN** the sender email matches a customer entity's `primary_email` (case-insensitive)
- **THEN** `customer_entity_id` is set to the matched entity ID
- **AND** `_confidence` gains +0.3
- **AND** `_customer_name` is populated from the matched entity

#### Scenario: Domain match with single result
- **WHEN** no exact email match exists but the sender domain matches one customer company's `domain`
- **THEN** `customer_entity_id` is set to that company's entity ID
- **AND** `_confidence` gains +0.15

#### Scenario: Domain match with multiple results
- **WHEN** the sender domain matches multiple customer companies
- **THEN** `customer_entity_id` is NOT set
- **AND** `_discrepancies` includes `{type: "ambiguous_customer", message: "Multiple customers match domain: ..."}`

#### Scenario: Freemail domain excluded
- **WHEN** the sender email uses a freemail domain (gmail.com, outlook.com, yahoo.com, etc.)
- **THEN** domain-level matching is skipped entirely
- **AND** only exact email matching is attempted

#### Scenario: No match
- **WHEN** neither exact email nor domain match produces a result
- **THEN** `_discrepancies` includes `{type: "unknown_contact", message: "..."}`
- **AND** `customer_entity_id` remains empty

---

### Requirement: Machine resolution in normalizePayload

After customer resolution, `normalizePayload` SHALL attempt to resolve `machine_hints` to a specific `machine_instance_id` using cross-module Knex queries.

Resolution requires a resolved `customer_entity_id`. Without it, machine resolution is skipped.

#### Scenario: Exact serial number match
- **WHEN** a machine hint matches a `machine_instances.serial_number` for the resolved customer
- **THEN** `machine_instance_id` is set to that instance ID
- **AND** `_confidence` gains +0.25
- **AND** `_machine_label` is populated

#### Scenario: Exact instance code match
- **WHEN** a machine hint matches a `machine_instances.instance_code` for the resolved customer
- **THEN** `machine_instance_id` is set to that instance ID
- **AND** `_confidence` gains +0.25

#### Scenario: Fuzzy catalog match
- **WHEN** a machine hint matches a catalog profile's `model_code` or `machine_family`
- **THEN** `machine_instance_id` is set if exactly one customer machine uses that catalog profile
- **AND** `_confidence` gains +0.1

#### Scenario: No machine match
- **WHEN** no machine hint resolves against the customer's machines
- **THEN** `_discrepancies` includes `{type: "machine_not_found", message: "..."}`
- **AND** `machine_instance_id` remains empty

#### Scenario: Single-machine customer with no hints
- **WHEN** the customer has exactly one active machine and no `machine_hints` were provided
- **THEN** that machine is auto-suggested as `machine_instance_id`
- **AND** `_confidence` gains +0.05

#### Scenario: No customer resolved
- **WHEN** `customer_entity_id` is empty after customer resolution
- **THEN** machine resolution is skipped entirely

---

### Requirement: Confidence assembly

The overall action confidence SHALL combine the LLM's own confidence with matching signals.

Formula: `min(1.0, llm_confidence * 0.5 + matching_signals)`

The 0.5 weight on LLM confidence prevents over-reliance on the LLM when there is no customer/machine match.

#### Scenario: High confidence with full match
- **WHEN** LLM confidence is 0.9, customer exact-matched (+0.3), and machine serial-matched (+0.25)
- **THEN** `_confidence` = min(1.0, 0.9 * 0.5 + 0.3 + 0.25) = 1.0

#### Scenario: Low confidence with no match
- **WHEN** LLM confidence is 0.6 and no customer or machine matched
- **THEN** `_confidence` = min(1.0, 0.6 * 0.5 + 0) = 0.3

#### Scenario: Confidence does not gate action visibility
- **WHEN** `_confidence` is below any threshold
- **THEN** the action still appears in the proposal (visibility is the LLM's decision, not gated by confidence)
