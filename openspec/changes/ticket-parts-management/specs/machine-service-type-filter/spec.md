## ADDED Requirements

### Requirement: Service type filtered by machine profile

The ticket form's service type dropdown SHALL be filtered to show only the service types supported by the selected machine's catalog profile (`supportedServiceTypes` field).

When no machine is selected, or when the machine's profile has no `supportedServiceTypes` (null or empty array), the full service type enum SHALL be shown.

#### Scenario: Machine with supported service types selected
- **WHEN** user selects a machine whose catalog profile has `supportedServiceTypes: ["commissioning", "maintenance"]`
- **THEN** the service type dropdown shows only "Commissioning" and "Maintenance"
- **AND** other service types are hidden from the dropdown

#### Scenario: Machine without supported service types
- **WHEN** user selects a machine whose catalog profile has `supportedServiceTypes: null` or `[]`
- **THEN** the service type dropdown shows all service types (no filtering)

#### Scenario: No machine selected
- **WHEN** no machine is selected on the ticket form
- **THEN** the service type dropdown shows all service types

#### Scenario: Current service type not supported by new machine
- **WHEN** user changes the machine selection
- **AND** the currently selected service type is not in the new machine's `supportedServiceTypes`
- **THEN** the service type field SHALL be cleared (reset to empty)
- **AND** the user must re-select a valid service type

#### Scenario: Current service type is supported by new machine
- **WHEN** user changes the machine selection
- **AND** the currently selected service type IS in the new machine's `supportedServiceTypes`
- **THEN** the service type selection remains unchanged

---

### Requirement: Supported service types shown in machine hints

The machine hints panel SHALL display the supported service types from the machine profile, so the user can see at a glance what service types apply to this machine.

#### Scenario: Machine profile has supported service types
- **WHEN** a machine is selected and its profile has `supportedServiceTypes`
- **THEN** the machine hints panel shows a "Supported service types" line listing the translated type names

#### Scenario: Machine profile has no supported service types
- **WHEN** a machine is selected and its profile has no `supportedServiceTypes`
- **THEN** the "Supported service types" line is not shown in the hints panel

---

### Requirement: Part recommendations filtered by service type

Recommended parts in the machine hints panel SHALL be filtered by the selected service type, using the mapping between ticket service types and part template `service_context` values.

The mapping SHALL be:
| Ticket `service_type` | Template `service_context` |
|---|---|
| `commissioning` | `startup` |
| `regular` | `repair` |
| `warranty_claim` | `reclamation` |
| `maintenance` | `preventive` |

#### Scenario: Service type selected — filter parts
- **WHEN** a machine is selected AND a service type is selected
- **THEN** the recommended parts list shows only part templates whose `service_context` matches the selected service type (per the mapping above)

#### Scenario: No service type selected — show all parts
- **WHEN** a machine is selected but no service type is selected
- **THEN** the recommended parts list shows all part templates for that machine (no service_context filter)

#### Scenario: Service type changed — parts refresh
- **WHEN** user changes the service type while a machine is selected
- **THEN** the recommended parts list re-fetches with the new `serviceContext` filter
- **AND** the parts list updates to show only matching templates

---

### Requirement: MachineProfileRecord includes supportedServiceTypes

The `machineOptions.ts` parser SHALL extract `supportedServiceTypes` from the machine profile API response and include it in the `MachineProfileRecord` type.

#### Scenario: Profile has supported service types
- **WHEN** the machine profile API returns `supported_service_types: ["commissioning", "maintenance"]`
- **THEN** `MachineProfileRecord.supportedServiceTypes` is `["commissioning", "maintenance"]`

#### Scenario: Profile has null supported service types
- **WHEN** the machine profile API returns `supported_service_types: null`
- **THEN** `MachineProfileRecord.supportedServiceTypes` is `null`
