# Capability: Tenant Scoping Fix

## Purpose

Ensure all machine catalog and machine instances command handlers enforce authenticated tenant scope, preventing cross-tenant data access.

## Requirements

### Requirement: Machine catalog commands SHALL enforce authenticated tenant scope

All machine_catalog command handlers (profiles.create, profiles.update, profiles.delete, part_templates.create, part_templates.update, part_templates.delete) SHALL extract `tenantId` and `organizationId` from the authenticated request context — not from user-supplied input. Queries for update and delete operations SHALL include both `tenantId` and `organizationId` in the filter criteria alongside the record `id`.

#### Scenario: Create profile uses authenticated scope, ignores input scope
- **WHEN** an authenticated user with tenantId "tenant-A" submits a create profile request with `tenantId: "tenant-B"` in the body
- **THEN** the created record SHALL have `tenantId: "tenant-A"` (from auth context), NOT "tenant-B" (from input)

#### Scenario: Update profile rejects cross-tenant access
- **WHEN** an authenticated user with tenantId "tenant-A" submits an update for a profile that belongs to tenantId "tenant-B"
- **THEN** the system SHALL return 404 (not found), because the query filters by the authenticated tenant scope

#### Scenario: Delete profile rejects cross-tenant access
- **WHEN** an authenticated user with tenantId "tenant-A" submits a delete for a profile belonging to tenantId "tenant-B"
- **THEN** the system SHALL return 404 (not found)

#### Scenario: Create part template uses authenticated scope
- **WHEN** an authenticated user submits a create part template request
- **THEN** the created record SHALL use `tenantId` and `organizationId` from the auth context, not from the request body

#### Scenario: Update part template rejects cross-tenant access
- **WHEN** an authenticated user with tenantId "tenant-A" submits an update for a part template belonging to tenantId "tenant-B"
- **THEN** the system SHALL return 404

### Requirement: Machine instances commands SHALL enforce authenticated tenant scope

All machine_instances command handlers (machines.create, machines.update, machines.delete) SHALL extract `tenantId` and `organizationId` from the authenticated request context. Queries for update and delete SHALL filter by authenticated scope.

#### Scenario: Create machine instance uses authenticated scope
- **WHEN** an authenticated user with tenantId "tenant-A" and organizationId "org-1" submits a create request with `tenantId: "tenant-B"` in the body
- **THEN** the created record SHALL have `tenantId: "tenant-A"` and `organizationId: "org-1"`

#### Scenario: Update machine instance rejects cross-tenant access
- **WHEN** an authenticated user with tenantId "tenant-A" submits an update for a machine instance belonging to tenantId "tenant-B"
- **THEN** the system SHALL return 404

#### Scenario: Delete machine instance rejects cross-tenant access
- **WHEN** an authenticated user with tenantId "tenant-A" submits a delete for a machine instance belonging to tenantId "tenant-B"
- **THEN** the system SHALL return 404

### Requirement: Scope extraction SHALL use ensureScope helper

All machine module commands SHALL use the `ensureScope(ctx)` pattern (as established in `service_tickets/commands/tickets.ts`) to extract and validate tenant/organization from the auth context. The helper SHALL throw 400 if tenant or organization context is missing.

#### Scenario: Missing tenant context returns 400
- **WHEN** a request arrives without `tenantId` in the auth context
- **THEN** the command SHALL throw a 400 error with message "Tenant context is required"

#### Scenario: Missing organization context returns 400
- **WHEN** a request arrives without `organizationId` in the auth context
- **THEN** the command SHALL throw a 400 error with message "Organization context is required"
