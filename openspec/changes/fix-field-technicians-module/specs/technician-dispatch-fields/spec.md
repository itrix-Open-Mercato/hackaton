## ADDED Requirements

### Requirement: Technician location status tracking
The `Technician` entity SHALL have a `locationStatus` text field with allowed values: `in_office`, `on_trip`, `at_client`, `unavailable`. The default value SHALL be `in_office`. The field SHALL be stored as column `location_status` on the `technicians` table.

#### Scenario: Create technician with default location status
- **WHEN** a user creates a technician without specifying `locationStatus`
- **THEN** the technician is created with `locationStatus = 'in_office'`

#### Scenario: Update technician location status
- **WHEN** a user updates a technician setting `locationStatus` to `at_client`
- **THEN** the technician's `locationStatus` is stored as `at_client`

#### Scenario: Reject invalid location status
- **WHEN** a user sends an update with `locationStatus = 'on_vacation'`
- **THEN** the system returns a 400 validation error

#### Scenario: Filter technicians by location status
- **WHEN** a user requests `GET /api/technicians` with `locationStatus=in_office`
- **THEN** the system returns only technicians with `location_status = 'in_office'`

### Requirement: Technician direct contact information
The `Technician` entity SHALL have optional fields: `firstName` (text, nullable), `lastName` (text, nullable), `email` (text, nullable, must be valid email format when provided), `phone` (text, nullable). These fields SHALL be stored as columns `first_name`, `last_name`, `email`, `phone` on the `technicians` table.

#### Scenario: Create technician with contact info
- **WHEN** a user creates a technician with `firstName: 'Jan'`, `lastName: 'Kowalski'`, `email: 'jan@firma.pl'`, `phone: '+48600000000'`
- **THEN** the technician is created with all contact fields stored

#### Scenario: Create technician without contact info
- **WHEN** a user creates a technician without firstName, lastName, email, or phone
- **THEN** the technician is created with all contact fields as null

#### Scenario: Update technician contact info
- **WHEN** a user updates a technician setting `email` to `new@firma.pl`
- **THEN** the technician's email is updated; other contact fields remain unchanged

#### Scenario: Reject invalid email format
- **WHEN** a user sends an update with `email: 'not-an-email'`
- **THEN** the system returns a 400 validation error

### Requirement: Technician vehicle and order assignment
The `Technician` entity SHALL have optional fields: `vehicleId` (UUID, nullable), `vehicleLabel` (text, nullable), `currentOrderId` (UUID, nullable). These fields SHALL be stored as columns `vehicle_id`, `vehicle_label`, `current_order_id` on the `technicians` table.

#### Scenario: Assign vehicle to technician
- **WHEN** a user updates a technician setting `vehicleId` and `vehicleLabel`
- **THEN** both fields are stored on the technician record

#### Scenario: Clear vehicle assignment
- **WHEN** a user updates a technician setting `vehicleId` to null
- **THEN** both `vehicleId` and `vehicleLabel` are set to null

#### Scenario: Assign current order to technician
- **WHEN** a user updates a technician setting `currentOrderId` to a valid UUID
- **THEN** the `currentOrderId` is stored on the technician record

### Requirement: Technician languages
The `Technician` entity SHALL have a `languages` JSONB array field (default empty array `[]`). Each element SHALL be a string. The field SHALL be stored as column `languages` on the `technicians` table.

#### Scenario: Create technician with languages
- **WHEN** a user creates a technician with `languages: ['pl', 'en', 'de']`
- **THEN** the technician is created with the languages array stored

#### Scenario: Update technician languages
- **WHEN** a user updates a technician setting `languages` to `['pl', 'en']`
- **THEN** the languages array replaces the previous value

### Requirement: Location status displayed in list and detail UI
The backend technician list page SHALL display a `locationStatus` column with colored badge indicators: green for `in_office`, blue for `on_trip`, amber for `at_client`, gray for `unavailable`. The detail page SHALL show the current location status with the same badge styling.

#### Scenario: List page shows location badges
- **WHEN** a user views the technicians list
- **THEN** each row displays a colored badge for the technician's location status

#### Scenario: Detail page shows location status
- **WHEN** a user views a technician's detail page
- **THEN** the page displays the current location status with a colored badge

### Requirement: Dispatch fields in create and edit forms
The create and edit forms SHALL include fields for: `firstName`, `lastName`, `email`, `phone`, `locationStatus` (select dropdown), `languages` (tags input). These fields SHALL be organized in form groups: Identity (firstName, lastName), Contact (email, phone), Status (locationStatus, isActive), Competencies (skills, languages).

#### Scenario: Create form includes dispatch fields
- **WHEN** a user navigates to the technician create page
- **THEN** the form displays fields for firstName, lastName, email, phone, locationStatus, and languages

#### Scenario: Edit form shows current values
- **WHEN** a user navigates to a technician's edit page
- **THEN** the form is pre-populated with the technician's current contact info, location status, and languages
