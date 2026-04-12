export type TechnicianListItem = {
  id: string
  staffMemberId: string
  staffMemberName?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  locationStatus?: string
  languages?: string[]
  vehicleId?: string | null
  vehicleLabel?: string | null
  currentOrderId?: string | null
  isActive: boolean
  notes?: string | null
  skills: string[]
  skillItems?: TechnicianSkillItem[]
  certificationCount: number
  certifications?: TechnicianCertificationItem[]
  tenantId?: string
  organizationId?: string
  createdAt?: string | null
}

export type TechnicianSkillItem = {
  id: string
  name: string
}

export type TechnicianCertificationItem = {
  id: string
  name: string
  certType?: string | null
  certificateNumber?: string | null
  code?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  issuedBy?: string | null
  notes?: string | null
  isExpired: boolean
}

export type TechnicianDetailItem = TechnicianListItem & {
  skillItems: TechnicianSkillItem[]
  certifications: TechnicianCertificationItem[]
}
