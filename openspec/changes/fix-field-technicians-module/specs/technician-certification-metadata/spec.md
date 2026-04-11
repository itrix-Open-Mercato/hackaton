## ADDED Requirements

### Requirement: Certification type classification
The `TechnicianCertification` entity SHALL have an optional `certType` text field stored as column `cert_type`. Accepted values include `sep`, `driving_license`, `other`, or any free-form string. The field SHALL be nullable.

#### Scenario: Create certification with type
- **WHEN** a user adds a certification with `certType: 'sep'`
- **THEN** the certification is created with `certType = 'sep'`

#### Scenario: Create certification without type
- **WHEN** a user adds a certification without specifying `certType`
- **THEN** the certification is created with `certType = null`

#### Scenario: Display cert type badge in UI
- **WHEN** a user views certifications on the detail page
- **THEN** each certification displays a badge with its `certType` value (if present)

### Requirement: Certification code and issuing authority
The `TechnicianCertification` entity SHALL have optional fields: `code` (text, nullable, stored as column `code`) for the certificate number or permit code, and `issuedBy` (text, nullable, stored as column `issued_by`) for the issuing authority or institution.

#### Scenario: Create certification with code and issuer
- **WHEN** a user adds a certification with `code: 'SEP-2024-001'` and `issuedBy: 'URE'`
- **THEN** the certification is created with both fields stored

#### Scenario: Display code and issuer in UI
- **WHEN** a user views a certification card on the detail page
- **THEN** the card displays the certificate code and issuing authority

### Requirement: Certification notes
The `TechnicianCertification` entity SHALL have an optional `notes` text field (nullable). This allows free-form annotation on each certification record.

#### Scenario: Add certification with notes
- **WHEN** a user adds a certification with `notes: 'Renewal pending'`
- **THEN** the certification is created with notes stored

#### Scenario: Display notes on certification card
- **WHEN** a user views a certification that has notes
- **THEN** the card displays the notes text

### Requirement: Certification soft delete
The `TechnicianCertification` entity SHALL have a `deletedAt` timestamptz field (nullable, stored as column `deleted_at`). Delete operations SHALL set `deletedAt` to the current timestamp. List queries SHALL exclude records where `deletedAt` is not null.

#### Scenario: Soft-delete a certification
- **WHEN** a user deletes a certification
- **THEN** the system sets `deletedAt` to the current timestamp instead of removing the row

#### Scenario: Soft-deleted certifications hidden from list
- **WHEN** a user lists certifications for a technician
- **THEN** certifications with non-null `deletedAt` are excluded from results

### Requirement: Certification expiry visual indicators
The certification UI SHALL display visual indicators for expiry status. A certification with `expiresAt` in the past SHALL display a red "Expired" badge with a destructive border. A certification with `expiresAt` within 30 days SHALL display an amber "Expiring soon" badge. Certifications without `expiresAt` or with distant expiry dates SHALL display no badge.

#### Scenario: Expired certification styling
- **WHEN** a user views a certification with `expiresAt` before today
- **THEN** the card displays a red "Expired" badge and destructive border

#### Scenario: Expiring soon certification styling
- **WHEN** a user views a certification with `expiresAt` within the next 30 days
- **THEN** the card displays an amber "Expiring soon" badge and amber border

#### Scenario: Valid certification styling
- **WHEN** a user views a certification with `expiresAt` more than 30 days away
- **THEN** the card displays no expiry badge

### Requirement: Enhanced certification form fields
The certification create/edit form SHALL include fields for: `name` (required), `certType` (select: sep, driving_license, other), `code` (text), `issuedAt` (date), `expiresAt` (date), `issuedBy` (text), `notes` (textarea). Fields SHALL be organized in form groups: Certificate Details (name, certType, code), Validity (issuedAt, expiresAt, issuedBy), Additional Info (notes).

#### Scenario: Add certification with all fields
- **WHEN** a user fills in all certification form fields and submits
- **THEN** the certification is created with all metadata stored

#### Scenario: Add certification with minimum fields
- **WHEN** a user fills in only the required `name` field and submits
- **THEN** the certification is created with only `name` populated; all other fields are null
