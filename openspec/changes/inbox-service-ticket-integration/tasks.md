## 1. Payload Schema & Action Scaffold

- [x] 1.1 Create `src/modules/service_tickets/data/inbox-validators.ts` with the `createServiceTicketPayloadSchema` Zod schema (all fields from spec: customer_email, customer_name, customer_entity_id, machine_hints, machine_instance_id, service_type, priority, description, address, contact_person_id, plus _ metadata fields)
- [x] 1.2 Create `src/modules/service_tickets/inbox-actions.ts` exporting `inboxActions: InboxActionDefinition[]` with a single `create_service_ticket` entry — wire `type`, `requiredFeature: 'service_tickets.create'`, `payloadSchema`, `promptSchema`, `promptRules`, stub `normalizePayload` (passthrough), and stub `execute` (return empty result)
- [x] 1.3 Run `yarn generate` and verify `create_service_ticket` appears in `.mercato/generated/inbox-actions.generated.ts`

## 2. LLM Prompt Schema & Rules

- [x] 2.1 Write `promptSchema` string describing the payload fields for LLM extraction (customer_email, customer_name, machine_hints[], service_type enum, priority enum, description, address)
- [x] 2.2 Write `promptRules` array: service vs. sales distinction, service_type inference from keywords, priority inference from urgency signals, machine_hints extraction guidance, description as 1-3 sentence summary

## 3. Customer Resolution

- [x] 3.1 Implement exact email match in `normalizePayload`: Knex query on `customer_entities` where `primary_email ILIKE $email`, scoped by `organization_id` and `deleted_at IS NULL`; set `customer_entity_id` and `_customer_name` on match, add +0.3 to confidence
- [x] 3.2 Implement domain fallback match: extract domain from email, check against freemail exclusion list (gmail.com, outlook.com, yahoo.com, hotmail.com, etc.), query `customer_companies.domain` joined to `customer_entities`; handle single match (+0.15 confidence) vs. multi-match (`ambiguous_customer` discrepancy)
- [x] 3.3 Implement no-match case: add `unknown_contact` discrepancy when neither exact nor domain match succeeds

## 4. Machine Resolution

- [x] 4.1 Implement machine hint matching in `normalizePayload`: if `customer_entity_id` resolved, fetch active `machine_instances` for that customer via Knex; match each hint against `serial_number` (+0.25) and `instance_code` (+0.25)
- [x] 4.2 Implement fuzzy catalog match: join `machine_instances` to `machine_catalog_profiles` via `catalog_product_id`, match hints against `model_code` and `machine_family` (+0.1 confidence if exactly one machine matches)
- [x] 4.3 Implement single-machine auto-suggest: if customer has exactly one active machine and no `machine_hints` provided, auto-suggest it (+0.05 confidence)
- [x] 4.4 Implement no-match discrepancy: add `machine_not_found` discrepancy when hints don't resolve; skip machine resolution entirely if no customer resolved

## 5. Confidence Assembly

- [x] 5.1 Implement confidence formula: `min(1.0, llm_confidence * 0.5 + matching_signals)` where matching_signals is the sum of customer and machine confidence boosts; store as `_confidence` in the normalized payload

## 6. Tests — Payload Schema

- [x] 6.1 Valid payload with only required field (`description`) passes validation
- [x] 6.2 Empty `description` fails with min-length error
- [x] 6.3 Invalid `service_type` enum value fails validation
- [x] 6.4 Invalid `priority` enum value fails validation
- [x] 6.5 `priority` defaults to `normal` when omitted
- [x] 6.6 `customer_email` with invalid email format fails validation
- [x] 6.7 Full payload with all optional fields passes validation
- [x] 6.8 Metadata fields (`_confidence`, `_discrepancies`, `_customer_name`, `_machine_label`) pass validation when present

## 7. Tests — Customer Resolution

- [x] 7.1 Exact email match sets `customer_entity_id` and `_customer_name`, adds +0.3 confidence
- [x] 7.2 Exact email match is case-insensitive (`User@Acme.COM` matches `user@acme.com`)
- [x] 7.3 Domain match with single result sets `customer_entity_id`, adds +0.15 confidence
- [x] 7.4 Domain match with multiple results does NOT set `customer_entity_id`, adds `ambiguous_customer` discrepancy with candidate names
- [x] 7.5 Freemail domains (gmail.com, outlook.com, yahoo.com, hotmail.com) skip domain matching entirely
- [x] 7.6 No match (neither exact nor domain) adds `unknown_contact` discrepancy, leaves `customer_entity_id` empty
- [x] 7.7 Exact match takes priority over domain match (exact found → domain match not attempted)
- [x] 7.8 Deleted customers (`deleted_at IS NOT NULL`) are excluded from matching
- [x] 7.9 Customers from other organizations are excluded (scoped by `organization_id`)

## 8. Tests — Machine Resolution

- [x] 8.1 Exact `serial_number` match sets `machine_instance_id` and `_machine_label`, adds +0.25 confidence
- [x] 8.2 Exact `instance_code` match sets `machine_instance_id`, adds +0.25 confidence
- [x] 8.3 Fuzzy catalog match (hint matches `model_code` or `machine_family`, exactly one customer machine uses that catalog profile) sets `machine_instance_id`, adds +0.1 confidence
- [x] 8.4 Fuzzy catalog match with multiple machines for the same profile does NOT auto-resolve, adds `machine_not_found` discrepancy
- [x] 8.5 No hint matches any customer machine → `machine_not_found` discrepancy, `machine_instance_id` remains empty
- [x] 8.6 Single-machine customer with no `machine_hints` auto-suggests that machine, adds +0.05 confidence
- [x] 8.7 Single-machine customer WITH `machine_hints` does NOT auto-suggest (hint matching takes priority)
- [x] 8.8 Machine resolution skipped entirely when `customer_entity_id` is empty
- [x] 8.9 Inactive machines (`is_active = false`) are excluded from matching

## 9. Tests — Confidence Assembly

- [x] 9.1 High confidence: LLM 0.9 + exact customer (+0.3) + serial match (+0.25) = capped at 1.0
- [x] 9.2 Low confidence: LLM 0.6 + no matching signals = 0.3
- [x] 9.3 Medium confidence: LLM 0.7 + domain match (+0.15) = 0.5
- [x] 9.4 Confidence never exceeds 1.0 regardless of accumulated signals
- [x] 9.5 Confidence is stored as `_confidence` in the normalized payload
- [x] 9.6 Confidence does not gate action visibility (action always returned regardless of score)

## 10. Tests — Freemail & Domain Utilities

- [x] 10.1 `isFreemailDomain` returns true for gmail.com, outlook.com, yahoo.com, hotmail.com, live.com, aol.com
- [x] 10.2 `isFreemailDomain` returns false for corporate domains (acme.com, example.org)
- [x] 10.3 `extractDomain` extracts domain from standard email formats
- [x] 10.4 `extractDomain` handles edge cases: uppercase, plus-addressing (user+tag@domain.com)

## 11. Widget Injection — Action Button

- [x] 11.1 Create or update `src/modules/service_tickets/widgets/injection-table.ts` to register an "Open Ticket Form" widget targeting the inbox proposal action card slot for `create_service_ticket` action type
- [x] 11.2 Create the widget component: on click, write `inbox_ops.serviceTicketDraft` to sessionStorage (actionId, proposalId, payload) and navigate to `/backend/service-tickets/create?fromInboxAction={actionId}`; silently catch sessionStorage errors

## 12. Tests — Action Button Widget

- [x] 12.1 Clicking "Open Ticket Form" writes correct JSON to sessionStorage key `inbox_ops.serviceTicketDraft` (actionId, proposalId, payload)
- [x] 12.2 Clicking "Open Ticket Form" navigates to `/backend/service-tickets/create?fromInboxAction={actionId}`
- [x] 12.3 When sessionStorage throws (e.g., quota exceeded), error is caught silently and navigation still proceeds
- [x] 12.4 Button renders only for `create_service_ticket` action type

## 13. Discrepancy Display Widget

- [x] 13.1 Create a discrepancy display component that reads `_discrepancies` from the action payload and renders warning indicators for `unknown_contact`, `ambiguous_customer`, and `machine_not_found`
- [x] 13.2 Wire the discrepancy component into the action card widget (alongside the "Open Ticket Form" button)

## 14. Tests — Discrepancy Display

- [x] 14.1 Renders `unknown_contact` warning when discrepancy present
- [x] 14.2 Renders `ambiguous_customer` warning with candidate names when discrepancy present
- [x] 14.3 Renders `machine_not_found` warning when discrepancy present
- [x] 14.4 Renders multiple discrepancies simultaneously
- [x] 14.5 Renders nothing when `_discrepancies` is empty array
- [x] 14.6 Renders nothing when `_discrepancies` is undefined

## 15. Ticket Create Page — Prefill Support

- [x] 15.1 Modify the ticket create page to check for `fromInboxAction` query param and read `inbox_ops.serviceTicketDraft` from sessionStorage on mount
- [x] 15.2 Merge prefill fields into form initial values: service_type, priority, description, customer_entity_id, contact_person_id, machine_instance_id, address — only override non-empty fields
- [x] 15.3 Show info banner when prefill data is present: "Pre-filled from email: {subject}" with link to `/backend/inbox-ops/proposals/{proposalId}`
- [x] 15.4 Remove the sessionStorage key after reading (one-time use); handle missing sessionStorage gracefully (open empty form, no error)

## 16. Tests — Prefill Merge Logic

- [x] 16.1 `mergeInboxPrefill` merges non-empty fields into default form values
- [x] 16.2 `mergeInboxPrefill` does not override existing defaults with empty/undefined prefill values
- [x] 16.3 `mergeInboxPrefill` handles all prefillable fields: service_type, priority, description, customer_entity_id, contact_person_id, machine_instance_id, address
- [x] 16.4 Prefill data is read from sessionStorage and key is removed after reading
- [x] 16.5 Missing sessionStorage key (no `fromInboxAction` or key already consumed) results in empty form, no error
- [x] 16.6 Malformed JSON in sessionStorage is handled gracefully (empty form, no crash)
- [x] 16.7 Info banner renders with email subject and proposal link when prefill active
- [x] 16.8 Info banner does not render when no prefill data

## 17. Post-Save Action Marking

- [x] 17.1 After successful ticket save, if `fromInboxAction` query param is present, call PATCH on the inbox action to mark it as `executed` with `createdEntityId` (ticket ID) and `createdEntityType: 'service_ticket'`
- [x] 17.2 Handle marking failure as non-blocking: show warning flash message but preserve the ticket save; do not attempt marking if no `fromInboxAction` param

## 18. Tests — Post-Save Action Marking

- [x] 18.1 Successful save with `fromInboxAction` param triggers PATCH with correct `createdEntityId` and `createdEntityType`
- [x] 18.2 Successful save without `fromInboxAction` param does NOT trigger any PATCH
- [x] 18.3 PATCH failure (network error / 500) shows warning flash but does not roll back ticket creation
- [x] 18.4 PATCH called with correct proposal and action IDs from sessionStorage metadata

## 19. Integration Verification

- [x] 19.1 Run `yarn generate` and verify full registry includes `create_service_ticket`
- [x] 19.2 Run `yarn test` — all new and existing tests pass
- [ ] 19.3 Manual test: send a service-related email to InboxOps → verify `create_service_ticket` action appears in proposal with extracted fields and resolved customer/machine
- [ ] 19.4 Manual test: click "Open Ticket Form" → verify ticket create page opens with prefilled fields and info banner
- [ ] 19.5 Manual test: save the prefilled ticket → verify inbox action is marked as executed
- [ ] 19.6 Manual test: email from unknown sender → verify `unknown_contact` discrepancy displayed; email with ambiguous domain → verify `ambiguous_customer` discrepancy
