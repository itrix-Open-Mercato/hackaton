## MODIFIED Requirements

### Requirement: All machine pages appear under unified sidebar group
All backend pages for `machine_catalog` and `machine_instances` modules — including list pages and create pages — SHALL appear under a single "MASZYNY" sidebar group using `pageGroupKey: 'machines.nav.group'`.

#### Scenario: Create pages grouped with list pages
- **WHEN** a user views the backend sidebar
- **THEN** the "Nowy profil maszyny" and "Nowy egzemplarz maszyny" entries appear under the same "MASZYNY" group as "Katalog maszyn" and "Egzemplarze maszyn"
- **THEN** there are no separate "MACHINE_CATALOG" or "MACHINE_INSTANCES" sidebar sections

#### Scenario: Sidebar after yarn generate
- **WHEN** `yarn generate` is run after updating create page metadata
- **THEN** the generated page registry reflects the updated `pageGroupKey` for all machine pages
