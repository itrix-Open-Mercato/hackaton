## MODIFIED Requirements

### Requirement: Machine edit pages load and display existing record data
The machine instance edit page (`/backend/machine-instances/[id]`) and machine catalog edit page (`/backend/machine-catalog/[id]`) SHALL fetch the record by ID on mount and populate all form fields with the existing data.

#### Scenario: Edit existing machine instance
- **WHEN** a user clicks "Edit" on a machine instance with code "RES-00041" from the list page
- **THEN** the edit form loads with all fields populated (instance code, serial number, site name, warranty status, etc.)
- **THEN** the form does not show empty/fallback values when the record exists

#### Scenario: Edit existing machine catalog profile
- **WHEN** a user clicks "Edit" on a machine catalog profile with family "Obrabiarki CNC" from the list page
- **THEN** the edit form loads with all fields populated (catalog product ID, machine family, model code, service defaults, etc.)
- **THEN** the form does not show empty/fallback values when the record exists

#### Scenario: Data mapping handles both snake_case and camelCase
- **WHEN** the API returns record data
- **THEN** the edit page data mapper SHALL handle both snake_case keys (e.g., `instance_code`) and camelCase keys (e.g., `instanceCode`) defensively

#### Scenario: Error shown when record not found
- **WHEN** a user navigates to an edit page with a non-existent ID
- **THEN** the page SHALL display an error message instead of an empty form
