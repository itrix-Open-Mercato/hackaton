import type { ResponseEnricher, EnricherContext } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Technician, TechnicianSkill } from './entities'

type TicketRecord = Record<string, unknown> & { id: string }

type TechnicianEnrichment = {
  _technicians: {
    assignments: Array<{
      staffMemberId: string
      technicianId: string | null
      skills: string[]
    }>
  }
}

const ticketTechnicianEnricher: ResponseEnricher<TicketRecord, TechnicianEnrichment> = {
  id: 'technicians.ticket-assignments',
  targetEntity: 'service_tickets:service_ticket',
  features: ['technicians.view'],
  priority: 10,
  timeout: 3000,
  fallback: {
    _technicians: { assignments: [] },
  },

  async enrichOne(record, context) {
    const em = (context.em as EntityManager).fork()
    const knex = (em as any).getConnection().getKnex()

    const assignmentRows: Array<{ staff_member_id: string }> = await knex('service_ticket_assignments')
      .select('staff_member_id')
      .where({ ticket_id: record.id, tenant_id: context.tenantId, organization_id: context.organizationId })

    if (!assignmentRows.length) {
      return { ...record, _technicians: { assignments: [] } }
    }

    const staffMemberIds = assignmentRows.map((a) => a.staff_member_id)
    const technicians = await em.find(Technician, {
      staffMemberId: { $in: staffMemberIds },
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)

    const techByStaffId = new Map<string, Technician>()
    for (const tech of technicians) {
      techByStaffId.set(tech.staffMemberId, tech)
    }

    const techIds = technicians.map((t) => t.id)
    const skills = techIds.length > 0
      ? await em.find(TechnicianSkill, {
          technician: { id: { $in: techIds } },
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        } as FilterQuery<TechnicianSkill>)
      : []

    const skillsByTechId = new Map<string, string[]>()
    for (const s of skills) {
      const techId = typeof s.technician === 'string' ? s.technician : s.technician?.id
      if (!techId) continue
      const arr = skillsByTechId.get(techId) || []
      arr.push(s.name)
      skillsByTechId.set(techId, arr)
    }

    const enrichedAssignments = staffMemberIds.map((staffMemberId) => {
      const tech = techByStaffId.get(staffMemberId)
      return {
        staffMemberId,
        technicianId: tech?.id ?? null,
        skills: tech ? (skillsByTechId.get(tech.id) || []) : [],
      }
    })

    return { ...record, _technicians: { assignments: enrichedAssignments } }
  },

  async enrichMany(records, context) {
    const em = (context.em as EntityManager).fork()
    const knex = (em as any).getConnection().getKnex()
    const ticketIds = records.map((r) => r.id)

    if (!ticketIds.length) {
      return records.map((r) => ({ ...r, _technicians: { assignments: [] } }))
    }

    const assignmentRows: Array<{ ticket_id: string; staff_member_id: string }> = await knex('service_ticket_assignments')
      .select('ticket_id', 'staff_member_id')
      .whereIn('ticket_id', ticketIds)
      .where({ tenant_id: context.tenantId, organization_id: context.organizationId })

    const assignmentsByTicket = new Map<string, string[]>()
    const allStaffMemberIds = new Set<string>()
    for (const a of assignmentRows) {
      const arr = assignmentsByTicket.get(a.ticket_id) || []
      arr.push(a.staff_member_id)
      assignmentsByTicket.set(a.ticket_id, arr)
      allStaffMemberIds.add(a.staff_member_id)
    }

    const staffIds = [...allStaffMemberIds]
    const technicians = staffIds.length > 0
      ? await em.find(Technician, {
          staffMemberId: { $in: staffIds },
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          deletedAt: null,
        } as FilterQuery<Technician>)
      : []

    const techByStaffId = new Map<string, Technician>()
    for (const tech of technicians) {
      techByStaffId.set(tech.staffMemberId, tech)
    }

    const techIds = technicians.map((t) => t.id)
    const skills = techIds.length > 0
      ? await em.find(TechnicianSkill, {
          technician: { id: { $in: techIds } },
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        } as FilterQuery<TechnicianSkill>)
      : []

    const skillsByTechId = new Map<string, string[]>()
    for (const s of skills) {
      const techId = typeof s.technician === 'string' ? s.technician : s.technician?.id
      if (!techId) continue
      const arr = skillsByTechId.get(techId) || []
      arr.push(s.name)
      skillsByTechId.set(techId, arr)
    }

    return records.map((record) => {
      const ticketStaffIds = assignmentsByTicket.get(record.id) || []
      const enrichedAssignments = ticketStaffIds.map((staffMemberId) => {
        const tech = techByStaffId.get(staffMemberId)
        return {
          staffMemberId,
          technicianId: tech?.id ?? null,
          skills: tech ? (skillsByTechId.get(tech.id) || []) : [],
        }
      })
      return { ...record, _technicians: { assignments: enrichedAssignments } }
    })
  },
}

export const enrichers: ResponseEnricher[] = [ticketTechnicianEnricher]
