import { randomUUID } from 'node:crypto'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TechnicianReservation, TechnicianReservationTechnician } from '../../technician_schedule/data/entities'
import { Technician } from '../../technicians/data/entities'
import type { ServiceTicket } from '../data/entities'

const DEFAULT_RESERVATION_DURATION_MS = 60 * 60 * 1000
const ACTIVE_TICKET_STATUSES = new Set(['new', 'scheduled', 'in_progress', 'on_hold', 'warranty_claim'])

export type TicketReservationSummary = {
  id: string
  technicianIds: string[]
  technicianNames: string[]
  startsAt: string
  endsAt: string
  status: string
  sourceType: string
  sourceTicketId: string | null
}

function resolveReservationWindow(ticket: Pick<ServiceTicket, 'visitDate' | 'visitEndDate'>): { startsAt: Date; endsAt: Date } | null {
  if (!ticket.visitDate) return null
  const startsAt = ticket.visitDate
  const endsAt = ticket.visitEndDate ?? new Date(ticket.visitDate.getTime() + DEFAULT_RESERVATION_DURATION_MS)
  return { startsAt, endsAt }
}

function buildReservationTitle(ticket: Pick<ServiceTicket, 'ticketNumber'>): string {
  return ticket.ticketNumber?.trim() ? `Service ticket ${ticket.ticketNumber.trim()}` : 'Service ticket'
}

async function listReservationAssignments(
  em: EntityManager,
  reservationIds: string[],
): Promise<Map<string, string[]>> {
  if (reservationIds.length === 0) return new Map()

  const assignments = await findWithDecryption(
    em,
    TechnicianReservationTechnician,
    { reservationId: { $in: reservationIds } },
    { fields: ['reservationId', 'technicianId'] },
  )

  const byReservation = new Map<string, string[]>()
  assignments.forEach((assignment) => {
    const next = byReservation.get(assignment.reservationId) ?? []
    next.push(assignment.technicianId)
    byReservation.set(assignment.reservationId, next)
  })
  return byReservation
}

async function replaceReservationAssignment(
  em: EntityManager,
  reservation: TechnicianReservation,
  technicianId: string,
): Promise<void> {
  const existingAssignments = await findWithDecryption(em, TechnicianReservationTechnician, { reservationId: reservation.id })
  existingAssignments.forEach((assignment) => em.remove(assignment))
  em.persist(
    em.create(TechnicianReservationTechnician, {
      reservationId: reservation.id,
      technicianId,
      tenantId: reservation.tenantId,
      organizationId: reservation.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )
}

async function resolveTechnicianIdsForAssignments(
  em: EntityManager,
  input: {
    tenantId: string
    organizationId: string
    staffMemberIds: string[]
  },
): Promise<string[]> {
  if (input.staffMemberIds.length === 0) return []

  const technicians = await findWithDecryption(
    em,
    Technician,
    {
      staffMemberId: { $in: input.staffMemberIds },
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
      isActive: true,
    } as FilterQuery<Technician>,
    { fields: ['id', 'staffMemberId'] },
  )

  const technicianIdByStaffId = new Map<string, string>()
  technicians.forEach((technician) => {
    technicianIdByStaffId.set(technician.staffMemberId, technician.id)
  })

  return input.staffMemberIds
    .map((staffMemberId) => technicianIdByStaffId.get(staffMemberId) ?? null)
    .filter((value): value is string => Boolean(value))
}

export async function syncTicketReservations(params: {
  em: EntityManager
  ticket: Pick<ServiceTicket, 'id' | 'ticketNumber' | 'status' | 'visitDate' | 'visitEndDate' | 'address' | 'organizationId' | 'tenantId'>
  staffMemberIds: string[]
}): Promise<void> {
  const { em, ticket, staffMemberIds } = params
  const reservationWindow = resolveReservationWindow(ticket)
  const technicianIds = await resolveTechnicianIdsForAssignments(em, {
    tenantId: ticket.tenantId,
    organizationId: ticket.organizationId,
    staffMemberIds: Array.from(new Set(staffMemberIds)),
  })
  const existingReservations = await findWithDecryption(
    em,
    TechnicianReservation,
    {
      tenantId: ticket.tenantId,
      organizationId: ticket.organizationId,
      sourceType: 'service_ticket',
      sourceTicketId: ticket.id,
      deletedAt: null,
    } as FilterQuery<TechnicianReservation>,
  )
  const assignmentsByReservation = await listReservationAssignments(em, existingReservations.map((reservation) => reservation.id))

  const existingReservationByTechnicianId = new Map<string, TechnicianReservation>()
  const duplicateReservations: TechnicianReservation[] = []

  existingReservations.forEach((reservation) => {
    const assignmentIds = assignmentsByReservation.get(reservation.id) ?? []
    const technicianId = assignmentIds[0] ?? null
    if (!technicianId) {
      duplicateReservations.push(reservation)
      return
    }

    if (existingReservationByTechnicianId.has(technicianId)) {
      duplicateReservations.push(reservation)
      return
    }

    existingReservationByTechnicianId.set(technicianId, reservation)
    if (assignmentIds.length > 1) {
      duplicateReservations.push(reservation)
    }
  })

  const shouldKeepReservations =
    reservationWindow !== null &&
    technicianIds.length > 0 &&
    ACTIVE_TICKET_STATUSES.has(ticket.status)

  if (!shouldKeepReservations) {
    existingReservations.forEach((reservation) => {
      reservation.status = 'cancelled'
      reservation.isActive = false
      reservation.updatedAt = new Date()
    })
    if (existingReservations.length > 0) {
      await em.flush()
    }
    return
  }

  const desiredTechnicianIds = new Set(technicianIds)
  const title = buildReservationTitle(ticket)
  const startsAt = reservationWindow.startsAt
  const endsAt = reservationWindow.endsAt

  for (const reservation of existingReservations) {
    const technicianId = (assignmentsByReservation.get(reservation.id) ?? [])[0] ?? null
    if (!technicianId || duplicateReservations.includes(reservation) || !desiredTechnicianIds.has(technicianId)) {
      reservation.status = 'cancelled'
      reservation.isActive = false
      reservation.updatedAt = new Date()
    }
  }

  for (const technicianId of desiredTechnicianIds) {
    const reservation = existingReservationByTechnicianId.get(technicianId)
    if (reservation) {
      reservation.title = title
      reservation.reservationType = 'client_visit'
      reservation.status = 'auto_confirmed'
      reservation.sourceType = 'service_ticket'
      reservation.sourceTicketId = ticket.id
      reservation.startsAt = startsAt
      reservation.endsAt = endsAt
      reservation.address = ticket.address ?? null
      reservation.isActive = true
      reservation.deletedAt = null
      reservation.updatedAt = new Date()
      await replaceReservationAssignment(em, reservation, technicianId)
      continue
    }

    const nextReservation = em.create(TechnicianReservation, {
      id: randomUUID(),
      tenantId: ticket.tenantId,
      organizationId: ticket.organizationId,
      title,
      reservationType: 'client_visit',
      status: 'auto_confirmed',
      sourceType: 'service_ticket',
      sourceTicketId: ticket.id,
      sourceOrderId: null,
      startsAt,
      endsAt,
      address: ticket.address ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    em.persist(nextReservation)
    await em.flush()
    await replaceReservationAssignment(em, nextReservation, technicianId)
  }

  await em.flush()
}

export async function cancelTicketReservations(params: {
  em: EntityManager
  ticketId: string
  tenantId: string
  organizationId: string
}): Promise<void> {
  const reservations = await findWithDecryption(
    params.em,
    TechnicianReservation,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      sourceType: 'service_ticket',
      sourceTicketId: params.ticketId,
      deletedAt: null,
    } as FilterQuery<TechnicianReservation>,
  )

  reservations.forEach((reservation) => {
    reservation.status = 'cancelled'
    reservation.isActive = false
    reservation.updatedAt = new Date()
  })

  if (reservations.length > 0) {
    await params.em.flush()
  }
}

export async function loadTicketReservationSummaries(params: {
  em: EntityManager
  ticketIds: string[]
  tenantId: string
  organizationId: string
}): Promise<Map<string, TicketReservationSummary[]>> {
  if (params.ticketIds.length === 0) return new Map()

  const reservations = await findWithDecryption(
    params.em,
    TechnicianReservation,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      sourceType: 'service_ticket',
      sourceTicketId: { $in: params.ticketIds },
      deletedAt: null,
    } as FilterQuery<TechnicianReservation>,
  )

  const assignmentsByReservation = await listReservationAssignments(params.em, reservations.map((reservation) => reservation.id))
  const allTechnicianIds = [...new Set([...assignmentsByReservation.values()].flat())]
  const technicianNameById = new Map<string, string>()

  if (allTechnicianIds.length > 0) {
    type TechnicianRow = {
      id: string
      display_name: string | null
      first_name: string | null
      last_name: string | null
    }
    const knex = (params.em as any).getConnection().getKnex()
    const rows = await knex<TechnicianRow>('technicians')
      .select('id', 'display_name', 'first_name', 'last_name')
      .whereIn('id', allTechnicianIds)

    rows.forEach((row) => {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
      technicianNameById.set(row.id, row.display_name ?? fullName ?? row.id)
    })
  }

  const summariesByTicket = new Map<string, TicketReservationSummary[]>()
  reservations.forEach((reservation) => {
    const ticketId = reservation.sourceTicketId ?? null
    if (!ticketId) return
    const technicianIds = assignmentsByReservation.get(reservation.id) ?? []
    const next = summariesByTicket.get(ticketId) ?? []
    next.push({
      id: reservation.id,
      technicianIds,
      technicianNames: technicianIds.map((technicianId) => technicianNameById.get(technicianId) ?? technicianId),
      startsAt: reservation.startsAt.toISOString(),
      endsAt: reservation.endsAt.toISOString(),
      status: reservation.status,
      sourceType: reservation.sourceType,
      sourceTicketId: reservation.sourceTicketId ?? null,
    })
    summariesByTicket.set(ticketId, next)
  })

  return summariesByTicket
}
