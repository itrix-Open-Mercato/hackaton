## ADDED Requirements

### Requirement: Technician create page SHALL redirect to the correct edit URL

After successfully creating a technician, the create page SHALL navigate to `/backend/technicians/<created-id>/edit` using the ID returned from the API response.

#### Scenario: Successful create redirects to edit page

- **WHEN** a coordinator submits the technician create form and the API returns success
- **THEN** the page SHALL redirect to `/backend/technicians/<id>/edit` where `<id>` is the UUID of the newly created technician
- **AND** the redirect SHALL NOT navigate to `/backend/technicians/undefined/edit`

### Requirement: Injection table SHALL use ModuleInjectionTable record shape

The `technicians/widgets/injection-table.ts` file SHALL export a `ModuleInjectionTable` record keyed by injection spot ID, not an array. Both a named `injectionTable` export and a `default` export SHALL be present.

#### Scenario: Injection table registers widgets correctly

- **WHEN** the application loads the technicians module's injection table
- **THEN** the sidebar menu widget SHALL be registered at the `menu:sidebar:main` spot
- **AND** the technician picker widget SHALL be registered at the `crud-form:service_tickets:service_ticket` spot
- **AND** widget IDs SHALL use the module-namespaced format (e.g., `technicians.injection.TechnicianMenuItem`)

### Requirement: Sidebar menu widget SHALL export InjectionMenuItemWidget with metadata

The `TechnicianMenuItem/widget.ts` file SHALL default-export an `InjectionMenuItemWidget` object with `metadata` and `menuItems` properties, not a bare array.

#### Scenario: Sidebar menu item appears in navigation

- **WHEN** the application loads widget injections
- **THEN** a "Technicians" menu item SHALL appear in the sidebar
- **AND** the menu item SHALL use a lucide-react icon component name (e.g., `HardHat`), not a string prefix format
- **AND** the menu item SHALL include `features` for ACL gating

### Requirement: Nested API route OpenAPI docs SHALL use methods wrapper

The `[id]/skills/route.ts` and `[id]/certifications/route.ts` files SHALL export `openApi` using the `{ methods: { GET: ..., POST: ... } }` shape, not flat top-level HTTP method keys.

#### Scenario: OpenAPI docs pass typecheck

- **WHEN** `yarn typecheck` runs against the technicians module API routes
- **THEN** all nested route `openApi` exports SHALL conform to the `OpenApiRouteDoc` type
- **AND** no type errors SHALL be reported for these files

### Requirement: FormHeader in edit mode SHALL NOT receive detail-only props

The technician edit page SHALL pass only edit-mode-compatible props to `FormHeader`. The `onDelete` prop SHALL NOT be passed in edit mode.

#### Scenario: Edit page FormHeader compiles without type errors

- **WHEN** `yarn typecheck` runs against the technician edit page
- **THEN** the `FormHeader` component call SHALL NOT produce type errors
- **AND** delete functionality SHALL be wired through the supported `actions` or `actionsContent` API if needed

### Requirement: FormFooter SHALL receive actions object

Both the technician create and edit pages SHALL pass a single `actions` object to `FormFooter` instead of individual top-level props (`cancelHref`, `submitLabel`, `isSubmitting`).

#### Scenario: FormFooter compiles without type errors

- **WHEN** `yarn typecheck` runs against the technician create and edit pages
- **THEN** the `FormFooter` component calls SHALL NOT produce type errors
- **AND** cancel and submit actions SHALL be functional

### Requirement: Empty notes string SHALL be preserved as null on update

When a coordinator clears the technician notes field (empty string), the edit page submit handler SHALL send the value in a way that the Zod schema transforms it to `null`, not convert it to `undefined` before sending.

#### Scenario: Clearing notes removes existing notes

- **WHEN** a coordinator clears the notes field on the technician edit form and saves
- **THEN** the API request SHALL include notes as empty string or `null`
- **AND** the technician's notes SHALL be set to `null` in the database
- **AND** the notes field SHALL NOT retain the previous value

### Requirement: Seed data SHALL use each staff member's own organization ID

When seeding technician profiles, the setup code SHALL use each staff member's own `organization_id`, not the first staff member's organization ID for all profiles.

#### Scenario: Multi-org tenant seed data scoped correctly

- **WHEN** `setup.ts` seeds technician profiles for a tenant with multiple organizations
- **THEN** each technician profile SHALL be created with the `organizationId` of the staff member it is linked to
- **AND** technicians SHALL appear in the correct organization's list
