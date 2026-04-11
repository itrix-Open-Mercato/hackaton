export type TechnicianListItem = {
  id: string
  staffMemberId: string
  staffMemberName?: string | null
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
  certificateNumber?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  isExpired: boolean
}

export type TechnicianDetailItem = TechnicianListItem & {
  skillItems: TechnicianSkillItem[]
  certifications: TechnicianCertificationItem[]
}
