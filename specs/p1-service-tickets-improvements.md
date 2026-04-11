# Plan: Service Tickets Improvements (P1.1)

## Context

Post-initial-implementation improvements for the `service_tickets` module. Branch: `feature/service-component`.

---

## Task 1 — Fix DataTable filters (status, serviceType, priority)

**Problem**: The multiSelect filters render in the UI but don't actually filter results. When selecting e.g. "Scheduled" in the status filter, the table still shows all tickets.

**Root cause investigation needed**:
- Check if the filter values are being sent as query params to the API (inspect network tab)
- The `onFiltersApply` callback sets `values` state, which feeds into `queryParams` — verify the filter keys (`status`, `service_type`, `priority`) are being appended to the URL params
- The API route `buildFilters` expects comma-separated values for `$in` operators — verify the multiSelect sends arrays that get joined with commas
- Check if the `FilterBar` component's `multiSelect` type sends values as arrays or strings

**Files to investigate**:
- `components/ServiceTicketsTable.tsx` — `queryParams` builder (lines ~120-140)
- `api/tickets/route.ts` — `buildFilters` (lines ~106-134)

**Fix approach**: Likely the filter values from `FilterValues` come as arrays, but the `queryParams` builder joins them with commas. Verify the API route correctly splits them back. May need to map filter keys to match the API query param names.

---

## Task 2 — Customer company autocomplete select

**Problem**: The `customer_entity_id` field is currently a plain text input where users must paste a UUID. This should be an autocomplete select that searches companies from the customers module.

**Implementation**:

### 2a. Create a company search API endpoint or use existing one

Check if `/api/customers/companies` supports search via `?search=` or `?displayName=` query param. The customers module likely already has this — verify via:
```
GET /api/customers/companies?search=acme&pageSize=10
```

### 2b. Replace text input with async autocomplete select in create/edit forms

Replace the `customer_entity_id` field definition in both create and edit pages:

```typescript
{
  id: 'customer_entity_id',
  label: t('service_tickets.form.fields.customerEntityId.label'),
  type: 'asyncSelect',  // or use a custom component
  loadOptions: async (search: string) => {
    const data = await fetchCrudList('customers/companies', { search, pageSize: 10 })
    return data.items.map(c => ({ value: c.id, label: c.display_name }))
  },
  placeholder: t('service_tickets.form.fields.customerEntityId.placeholder'),
}
```

If `CrudForm` doesn't support `asyncSelect`, use a `component` group with a custom React component that uses `@tanstack/react-query` + a combobox/autocomplete UI primitive.

**Reference**: Check how other modules handle entity references in forms — look at `packages/core/src/modules/customers/backend/` for deal→company linking patterns.

---

## Task 3 — Cascading contact person select (after company selected)

**Problem**: Once a company is selected, we need a second select that shows people (contacts) associated with that company.

**Implementation**:

### 3a. Add a `contact_person_id` field to the ticket entity and validator

Add to `data/entities.ts`:
```typescript
@Property({ name: 'contact_person_id', type: 'uuid', nullable: true })
contactPersonId?: string | null
```

Add to `data/validators.ts` in both create and update schemas:
```typescript
contact_person_id: nullableUuid,
```

Update `types.ts` to include `contactPersonId`.

### 3b. Add cascading select in create/edit forms

Use a custom component group that:
1. Renders a company autocomplete (from Task 2)
2. When company is selected, fetches people linked to that company:
   ```
   GET /api/customers/people?companyEntityId={selectedCompanyId}&pageSize=50
   ```
3. Renders a person select populated with results
4. When company changes, clears the person selection and reloads options

```typescript
// In the form groups:
{
  id: 'customerSection',
  title: t('service_tickets.form.groups.customer'),
  column: 2,
  component: ({ values, setValue }) => (
    <CustomerCascadeSelect
      companyId={values.customer_entity_id}
      personId={values.contact_person_id}
      onCompanyChange={(id) => {
        setValue('customer_entity_id', id)
        setValue('contact_person_id', '')  // clear person when company changes
      }}
      onPersonChange={(id) => setValue('contact_person_id', id)}
    />
  ),
}
```

### 3c. Create `CustomerCascadeSelect` component

New file: `components/CustomerCascadeSelect.tsx`

Uses two `useQuery` hooks:
- Companies: debounced search, fetches from `/api/customers/companies`
- People: filtered by `companyEntityId`, fetches from `/api/customers/people`

---

## Implementation order

```
Task 1 (filters) → independent, can be done first
Task 2 (company autocomplete) → depends on understanding CrudForm capabilities
Task 3 (cascading person select) → depends on Task 2 + new entity field + migration
```

## Verification

- Task 1: Select "Scheduled" filter → only scheduled tickets appear. Clear → all appear.
- Task 2: Type "Acme" in company field → dropdown shows matching companies. Select one → UUID stored.
- Task 3: Select company → person dropdown loads contacts. Change company → person clears and reloads.
