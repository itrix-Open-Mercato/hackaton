## 1. Data Layer — Extend machineOptions.ts Parsers

- [ ] 1.1 Add `partCatalogProductId` field to `MachinePartTemplateRecord` type and update `toMachinePartTemplateRecord` parser to extract `partCatalogProductId` / `part_catalog_product_id`
- [ ] 1.2 Add `supportedServiceTypes` field to `MachineProfileRecord` type and update `toMachineProfileRecord` parser to extract `supportedServiceTypes` / `supported_service_types` (as `string[] | null`)
- [ ] 1.3 Add `serviceTypeToServiceContext` mapping constant (`commissioning→startup`, `regular→repair`, `warranty_claim→reclamation`, `maintenance→preventive`) — place in `machineOptions.ts` or a shared constants file
- [ ] 1.4 Update `fetchMachinePartTemplates` to accept optional `serviceContext` parameter and pass it to the API query string when provided

## 2. Service Type Filtering by Machine

- [ ] 2.1 Add `onSupportedServiceTypesChange` callback prop to `MachineCascadeSelect` — called with `string[] | null` when machine profile loads
- [ ] 2.2 In `MachineCascadeSelect`, call `onSupportedServiceTypesChange` when profile loads (passing `profile.supportedServiceTypes`) and when machine is cleared (passing `null`)
- [ ] 2.3 Display supported service types in the machine hints panel (translated names, below service notes)
- [ ] 2.4 In `ticketFormConfig.tsx`, wire `onSupportedServiceTypesChange` to filter the service type field options — store `supportedServiceTypes` in component state, filter `SERVICE_TYPE_VALUES` when rendering
- [ ] 2.5 When supported types change and current `service_type` value is not in the new list, clear the `service_type` field via `setValue('service_type', '')`

## 3. Part Recommendations Filtered by Service Type

- [ ] 3.1 Add `serviceType` prop to `MachineCascadeSelect` (the current ticket service_type value)
- [ ] 3.2 When `serviceType` or `selectedMachine` changes, re-fetch part templates with the mapped `serviceContext` filter (use the mapping from 1.3). When `serviceType` is empty, fetch without filter.
- [ ] 3.3 Update the `useEffect` that loads hints to depend on `serviceType` and pass the serviceContext param to `fetchMachinePartTemplates`

## 4. One-Click Add Part from Recommendations

- [ ] 4.1 Add `onAddPart` callback prop to `MachineCascadeSelect` — signature: `(template: MachinePartTemplateRecord) => void`
- [ ] 4.2 Render a "+" `IconButton` next to each recommended part that has a `partCatalogProductId`. Hide the button for templates without it.
- [ ] 4.3 On click, call `onAddPart(template)` — the parent handles the API call

## 5. Ticket Parts Section Component

- [ ] 5.1 Create `TicketPartsSection` component in `src/modules/service_tickets/components/TicketPartsSection.tsx` — accepts `ticketId: string` prop
- [ ] 5.2 On mount, fetch parts via `GET /api/service_tickets/parts?ticket_id={ticketId}&sortField=created_at&sortDir=asc` using `readApiResultOrThrow`
- [ ] 5.3 Render parts as a table: columns for part name, quantity, notes, actions (edit/delete). Show empty state when no parts.
- [ ] 5.4 Part name resolution: maintain a `Map<string, MachinePartTemplateRecord>` keyed by `partCatalogProductId`. Populate from the machine hints templates (passed as prop or fetched). Fallback to truncated UUID for unresolvable IDs.
- [ ] 5.5 Implement delete: call `DELETE /api/service_tickets/parts?id={partId}`, then re-fetch the parts list
- [ ] 5.6 Implement inline edit: clicking edit makes quantity/notes fields editable. Save calls `PUT /api/service_tickets/parts` with `id`, `quantity`, `notes`. Escape cancels and reverts.
- [ ] 5.7 Expose `addPart(template: MachinePartTemplateRecord)` method (via ref or callback registration) that calls `POST /api/service_tickets/parts` with `ticket_id`, `product_id` from `template.partCatalogProductId`, `quantity` from `template.quantityDefault` (default 1), then re-fetches the list

## 6. Wire Everything into the Edit Page

- [ ] 6.1 In `edit/page.tsx`, render `TicketPartsSection` below the `CrudForm`, passing the ticket `id`
- [ ] 6.2 Wire `MachineCascadeSelect.onAddPart` through to `TicketPartsSection.addPart` — use a shared ref or callback state lifted to the edit page
- [ ] 6.3 Pass the current `service_type` form value to `MachineCascadeSelect` as `serviceType` prop so part recommendations filter correctly

## 7. Translations

- [ ] 7.1 Add EN/PL translation keys for the parts section: section title, empty state, column headers (name, quantity, notes, actions), add/edit/save/cancel/delete button labels, loading state
- [ ] 7.2 Add EN/PL translation keys for machine hints: "Supported service types" label
- [ ] 7.3 Add EN/PL translation keys for add-from-recommendation button tooltip

## 8. Testing

- [ ] 8.1 Unit test for `serviceTypeToServiceContext` mapping — verify all four mappings and edge cases (unknown type returns undefined)
- [ ] 8.2 Unit test for updated `toMachineProfileRecord` — verify `supportedServiceTypes` extraction for array, null, and missing cases
- [ ] 8.3 Unit test for updated `toMachinePartTemplateRecord` — verify `partCatalogProductId` extraction
- [ ] 8.4 Manual test: select machine with `supportedServiceTypes` → verify service type dropdown filters, verify clearing machine restores full dropdown
- [ ] 8.5 Manual test: select machine + service type → verify part recommendations filter by service context
- [ ] 8.6 Manual test: click "+" on recommended part → verify part appears in parts section, verify parts CRUD (edit quantity, delete)
