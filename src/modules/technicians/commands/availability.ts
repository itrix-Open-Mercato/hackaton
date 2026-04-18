import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { Technician } from '../data/entities'
import { availabilityCreateSchema, availabilityUpdateSchema, availabilityDeleteSchema } from '../data/validators'
import { ensureScope } from './technicians'
import { TechnicianReservation } from '../../technician_schedule/data/entities'
import { createUtcDayRange, getDateToken } from '../../technician_schedule/lib/dateTime'

function buildAvailabilityTitle(dayType: 'trip' | 'unavailable' | 'holiday'): string {
  const labels: Record<'trip' | 'unavailable' | 'holiday', string> = {
    trip: 'Trip',
    unavailable: 'Unavailable',
    holiday: 'Holiday',
  }
  return labels[dayType]
}

async function findAvailabilityReservation(
  em: EntityManager,
  params: { id?: string; technicianId?: string; date?: string; tenantId: string; organizationId: string },
) {
  if (params.id) {
    return findOneWithDecryption(em, TechnicianReservation, {
      id: params.id,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      entryKind: 'availability',
      deletedAt: null,
    } as FilterQuery<TechnicianReservation>)
  }

  if (!params.technicianId || !params.date) return null
  const dayRange = createUtcDayRange(params.date)
  return findOneWithDecryption(em, TechnicianReservation, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    entryKind: 'availability',
    startsAt: dayRange.startsAt,
    technicianId: undefined,
    deletedAt: null,
  } as FilterQuery<TechnicianReservation>)
}

async function findAvailabilityAssignments(
  em: EntityManager,
  technicianId: string,
  date: string,
  tenantId: string,
  organizationId: string,
): Promise<TechnicianReservation | null> {
  const { startsAt } = createUtcDayRange(date)
  const items = await em.find(TechnicianReservation, {
    tenantId,
    organizationId,
    entryKind: 'availability',
    startsAt,
    deletedAt: null,
  } as FilterQuery<TechnicianReservation>)
  if (items.length === 0) return null
  const reservationIds = items.map((item) => item.id)
  const rows = await em.getConnection().execute<Array<{ reservation_id: string; technician_id: string }>>(
    `
      select reservation_id, technician_id
      from technician_reservation_technicians
      where tenant_id = ?
        and organization_id = ?
        and technician_id = ?
        and reservation_id in (${reservationIds.map(() => '?').join(', ')})
    `,
    [tenantId, organizationId, technicianId, ...reservationIds],
  )
  const match = rows[0]?.reservation_id
  return match ? (items.find((item) => item.id === match) ?? null) : null
}

export const createAvailabilityCommand: CommandHandler<Record<string, unknown>, TechnicianReservation> = {
  id: 'technicians.availability.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const technician = await em.findOne(Technician, {
      id: parsed.technician_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    if (parsed.day_type === 'work_day') {
      throw new CrudHttpError(422, { error: 'work_day is implicit and must not be persisted' })
    }

    const existing = await findAvailabilityAssignments(
      em,
      parsed.technician_id,
      parsed.date,
      scope.tenantId,
      scope.organizationId,
    )
    if (existing) {
      throw new CrudHttpError(409, { error: 'Availability record already exists for this day' })
    }

    const { startsAt, endsAt } = createUtcDayRange(parsed.date)
    const reservation = em.create(TechnicianReservation, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      title: buildAvailabilityTitle(parsed.day_type),
      reservationType: null,
      entryKind: 'availability',
      availabilityType: parsed.day_type,
      status: 'confirmed',
      sourceType: 'manual',
      startsAt,
      endsAt,
      allDay: true,
      notes: parsed.notes ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    em.persist(reservation)
    await em.flush()
    await em.getConnection().execute(
      `
        insert into technician_reservation_technicians
          (id, reservation_id, technician_id, organization_id, tenant_id, created_at, updated_at)
        values
          (gen_random_uuid(), ?, ?, ?, ?, now(), now())
      `,
      [reservation.id, parsed.technician_id, scope.organizationId, scope.tenantId],
    )

    return reservation
  },
}

export const updateAvailabilityCommand: CommandHandler<Record<string, unknown>, TechnicianReservation> = {
  id: 'technicians.availability.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const availability = await findAvailabilityReservation(em, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    if (!availability) throw new CrudHttpError(404, { error: 'Availability record not found' })

    if (parsed.day_type === 'work_day') {
      throw new CrudHttpError(422, { error: 'work_day is implicit and must not be persisted' })
    }

    if (parsed.day_type !== undefined) {
      availability.availabilityType = parsed.day_type
      availability.title = buildAvailabilityTitle(parsed.day_type)
    }
    if (parsed.notes !== undefined) availability.notes = parsed.notes
    availability.updatedAt = new Date()
    await em.flush()

    return availability
  },
}

export const deleteAvailabilityCommand: CommandHandler<Record<string, unknown>, { ok: boolean }> = {
  id: 'technicians.availability.delete',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityDeleteSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const availability = await findAvailabilityReservation(em, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    if (!availability) throw new CrudHttpError(404, { error: 'Availability record not found' })

    availability.deletedAt = new Date()
    availability.isActive = false
    availability.updatedAt = new Date()
    await em.flush()

    return { ok: true }
  },
}

export function mapAvailabilityReservation(record: TechnicianReservation, technicianId: string) {
  return {
    id: record.id,
    technician_id: technicianId,
    date: getDateToken(record.startsAt),
    day_type: record.availabilityType,
    notes: record.notes ?? null,
    created_at: record.createdAt?.toISOString?.() ?? null,
    updated_at: record.updatedAt?.toISOString?.() ?? null,
  }
}

registerCommand(createAvailabilityCommand)
registerCommand(updateAvailabilityCommand)
registerCommand(deleteAvailabilityCommand)
