import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Technician, TechnicianSkill, TechnicianCertification } from './data/entities'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['technicians.*'],
    admin: ['technicians.*'],
    employee: ['technicians.view', 'technicians.create', 'technicians.edit'],
  },

  async seedExamples({ em, tenantId, container }) {
    const knex = (em as any).getConnection().getKnex()

    // Find staff team members to link technicians to
    const staffMembers = await knex('staff_team_members')
      .select('id', 'display_name', 'tenant_id', 'organization_id')
      .where({ tenant_id: tenantId, is_active: true, deleted_at: null })
      .limit(3)

    if (!staffMembers.length) return

    const technicianSeeds = [
      {
        staffMember: staffMembers[0],
        skills: ['Electrical', 'HVAC', 'PLC Programming'],
        certifications: [
          { name: 'ISO 9001 Auditor', certificateNumber: 'ISO-2025-001', expiresAt: new Date('2027-06-30') },
          { name: 'Electrical Safety', certificateNumber: 'ES-2025-042', expiresAt: new Date('2026-12-31') },
        ],
      },
      {
        staffMember: staffMembers[1],
        skills: ['Mechanical', 'Welding', 'Hydraulics'],
        certifications: [
          { name: 'Welding Certificate', certificateNumber: 'WC-2025-018', expiresAt: new Date('2027-03-15') },
        ],
      },
      {
        staffMember: staffMembers[2],
        skills: ['HVAC', 'Refrigeration', 'Electrical'],
        certifications: [
          { name: 'Refrigerant Handling', certificateNumber: 'RH-2025-007', expiresAt: new Date('2026-09-30') },
          { name: 'First Aid', certificateNumber: 'FA-2025-100', expiresAt: new Date('2027-01-15') },
        ],
      },
    ].filter((s) => s.staffMember)

    for (const seed of technicianSeeds) {
      // Check if technician already exists for this staff member
      const staffOrgId = seed.staffMember.organization_id
      const existing = await em.findOne(Technician, {
        staffMemberId: seed.staffMember.id,
        tenantId,
        organizationId: staffOrgId,
        deletedAt: null,
      } as FilterQuery<Technician>)
      if (existing) continue

      const technician = em.create(Technician, {
        staffMemberId: seed.staffMember.id,
        isActive: true,
        notes: `Seeded technician profile for ${seed.staffMember.display_name}`,
        tenantId,
        organizationId: staffOrgId,
      })
      em.persist(technician)
      await em.flush()

      for (const skillName of seed.skills) {
        const skill = em.create(TechnicianSkill, {
          technician,
          name: skillName,
          tenantId,
          organizationId: staffOrgId,
        })
        em.persist(skill)
      }

      for (const cert of seed.certifications) {
        const certification = em.create(TechnicianCertification, {
          technician,
          name: cert.name,
          certificateNumber: cert.certificateNumber,
          issuedAt: new Date('2025-01-01'),
          expiresAt: cert.expiresAt,
          tenantId,
          organizationId: staffOrgId,
        })
        em.persist(certification)
      }

      await em.flush()
    }
  },
}

export default setup
