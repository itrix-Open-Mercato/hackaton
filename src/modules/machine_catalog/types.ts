export type MachineCatalogProfileListItem = {
  id: string
  catalogProductId: string | null
  machineFamily: string | null
  modelCode: string | null
  supportedServiceTypes: string[] | null
  requiredSkills: string[] | null
  requiredCertifications: string[] | null
  defaultTeamSize: number | null
  defaultServiceDurationMinutes: number | null
  preventiveMaintenanceIntervalDays: number | null
  defaultWarrantyMonths: number | null
  startupNotes: string | null
  serviceNotes: string | null
  isActive: boolean
  tenantId?: string
  organizationId?: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type MachineCatalogProfileFormValues = {
  catalog_product_id: string
  machine_family: string
  model_code: string
  supported_service_types: string
  required_skills: string
  required_certifications: string
  default_team_size: string
  default_service_duration_minutes: string
  preventive_maintenance_interval_days: string
  default_warranty_months: string
  startup_notes: string
  service_notes: string
  is_active: boolean
}

export type MachinePartTemplateItem = {
  id: string
  machineProfileId: string
  catalogProductId: string | null
  partCode: string | null
  partName: string
  defaultQuantity: number
  notes: string | null
  isActive: boolean
}
