export type MachineInstanceListItem = {
  id: string
  instanceCode: string
  serialNumber: string | null
  customerCompanyId: string | null
  siteName: string | null
  locationLabel: string | null
  contactName: string | null
  contactPhone: string | null
  catalogProductId: string | null
  manufacturedAt: string | null
  commissionedAt: string | null
  warrantyUntil: string | null
  warrantyStatus: string | null
  lastInspectionAt: string | null
  nextInspectionAt: string | null
  serviceCount: number | null
  complaintCount: number | null
  lastServiceCaseCode: string | null
  requiresAnnouncement: boolean | null
  announcementLeadTimeHours: number | null
  instanceNotes: string | null
  isActive: boolean
  tenantId?: string
  organizationId?: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type MachineInstanceFormValues = {
  instance_code: string
  serial_number: string
  catalog_product_id: string
  customer_company_id: string
  site_name: string
  site_address: string
  location_label: string
  contact_name: string
  contact_phone: string
  manufactured_at: string
  commissioned_at: string
  warranty_until: string
  warranty_status: string
  last_inspection_at: string
  next_inspection_at: string
  requires_announcement: boolean
  announcement_lead_time_hours: string
  instance_notes: string
  is_active: boolean
}
