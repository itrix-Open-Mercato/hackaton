import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '../lib/atomic'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  cancelReservationSchema,
  technicianReservationCreateSchema,
  technicianReservationUpdateSchema,
  type CancelReservationInput,
  type TechnicianReservationCreateInput,
  type TechnicianReservationUpdateInput,
} from '../data/validators'
import { TechnicianReservation, TechnicianReservationTechnician } from '../data/entities'
import { checkReservationOverlap } from '../lib/overlapCheck'

type ReservationSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  title: string
  reservationType: TechnicianReservation['reservationType']
  status: TechnicianReservation['status']
  sourceType: TechnicianReservation['sourceType']
  sourceOrderId: string | null
  startsAt: string
  endsAt: string
  vehicleId: string | null
  vehicleLabel: string | null
  customerName: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  deletedAt: string | null
  technicianIds: string[]
}

type ReservationUndoPayload = {
  before?: ReservationSnapshot | null
  after?: ReservationSnapshot | null
}

function buildReservationTitle(input: {
  title?: string | null
  reservationType: TechnicianReservation['reservationType']
  customerName?: string | null
}): string {
  const trimmed = typeof input.title === 'string' ? input.title.trim() : ''
  if (trimmed.length > 0) return trimmed

  const typeLabelMap: Record<TechnicianReservation['reservationType'], string> = {
    client_visit: 'Client visit',
    internal_work: 'Internal work',
    leave: 'Leave',
    training: 'Training',
  }

  return input.customerName?.trim()
    ? `${typeLabelMap[input.reservationType]} - ${input.customerName.trim()}`
    : typeLabelMap[input.reservationType]
}

function buildScopeFilter(ctx: CommandRuntimeContext): Record<string, unknown> {
  const filter: Record<string, unknown> = {}
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationIds = ctx.organizationIds ?? null
  const selectedOrganizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null

  if (tenantId) filter.tenantId = tenantId
  if (Array.isArray(organizationIds) && organizationIds.length > 0) {
    filter.organizationId = { $in: organizationIds }
  } else if (selectedOrganizationId) {
    filter.organizationId = selectedOrganizationId
  }

  return filter
}

async function listReservationTechnicianIds(em: EntityManager, reservationId: string): Promise<string[]> {
  const assignments = await findWithDecryption(
    em,
    TechnicianReservationTechnician,
    { reservationId },
    { fields: ['technicianId'], orderBy: { technicianId: 'asc' } },
  )
  return assignments.map((item) => item.technicianId)
}

async function loadReservationSnapshot(em: EntityManager, id: string): Promise<ReservationSnapshot | null> {
  const reservation = await findOneWithDecryption(em, TechnicianReservation, { id })
  if (!reservation) return null

  const technicianIds = await listReservationTechnicianIds(em, reservation.id)
  return {
    id: reservation.id,
    tenantId: reservation.tenantId,
    organizationId: reservation.organizationId,
    title: reservation.title,
    reservationType: reservation.reservationType,
    status: reservation.status,
    sourceType: reservation.sourceType,
    sourceOrderId: reservation.sourceOrderId ?? null,
    startsAt: reservation.startsAt.toISOString(),
    endsAt: reservation.endsAt.toISOString(),
    vehicleId: reservation.vehicleId ?? null,
    vehicleLabel: reservation.vehicleLabel ?? null,
    customerName: reservation.customerName ?? null,
    address: reservation.address ?? null,
    notes: reservation.notes ?? null,
    isActive: reservation.isActive,
    deletedAt: reservation.deletedAt ? reservation.deletedAt.toISOString() : null,
    technicianIds,
  }
}

async function requireReservationForMutation(
  em: EntityManager,
  ctx: CommandRuntimeContext,
  id: string,
): Promise<TechnicianReservation> {
  const reservation = await findOneWithDecryption(em, TechnicianReservation, {
    id,
    deletedAt: null,
    ...buildScopeFilter(ctx),
  })

  if (!reservation) {
    throw new CrudHttpError(404, { error: 'Reservation not found.' })
  }

  return reservation
}

function applySnapshotToReservation(
  reservation: TechnicianReservation,
  snapshot: ReservationSnapshot,
): void {
  reservation.tenantId = snapshot.tenantId
  reservation.organizationId = snapshot.organizationId
  reservation.title = snapshot.title
  reservation.reservationType = snapshot.reservationType
  reservation.status = snapshot.status
  reservation.sourceType = snapshot.sourceType
  reservation.sourceOrderId = snapshot.sourceOrderId
  reservation.startsAt = new Date(snapshot.startsAt)
  reservation.endsAt = new Date(snapshot.endsAt)
  reservation.vehicleId = snapshot.vehicleId
  reservation.vehicleLabel = snapshot.vehicleLabel
  reservation.customerName = snapshot.customerName
  reservation.address = snapshot.address
  reservation.notes = snapshot.notes
  reservation.isActive = snapshot.isActive
  reservation.deletedAt = snapshot.deletedAt ? new Date(snapshot.deletedAt) : null
  reservation.updatedAt = new Date()
}

async function replaceAssignments(
  em: EntityManager,
  reservation: TechnicianReservation,
  technicianIds: string[],
): Promise<void> {
  const existing = await findWithDecryption(em, TechnicianReservationTechnician, { reservationId: reservation.id })
  existing.forEach((assignment) => em.remove(assignment))

  technicianIds.forEach((technicianId) => {
    em.persist(
      em.create(TechnicianReservationTechnician, {
        reservationId: reservation.id,
        technicianId,
        organizationId: reservation.organizationId,
        tenantId: reservation.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    )
  })
}

const createReservationCommand: CommandHandler<TechnicianReservationCreateInput, { reservationId: string }> = {
  id: 'technician_schedule.reservation.create',
  async execute(rawInput, ctx) {
    const parsed = technicianReservationCreateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const startsAt = new Date(parsed.startsAt)
    const endsAt = new Date(parsed.endsAt)
    const technicianIds = Array.from(new Set(parsed.technicianIds))

    const conflict = await checkReservationOverlap(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      technicianIds,
      startsAt,
      endsAt,
    })

    if (conflict.hasConflict) {
      throw new CrudHttpError(409, {
        error: 'OVERLAP_CONFLICT',
        conflictingTechnicianIds: conflict.conflictingTechnicianIds,
      })
    }

    const reservationId = randomUUID()
    const reservation = em.create(TechnicianReservation, {
      id: reservationId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      title: buildReservationTitle(parsed),
      reservationType: parsed.reservationType,
      status: parsed.status ?? 'confirmed',
      sourceType: parsed.sourceType ?? 'manual',
      sourceOrderId: parsed.sourceOrderId ?? null,
      startsAt,
      endsAt,
      vehicleId: parsed.vehicleId ?? null,
      vehicleLabel: parsed.vehicleLabel ?? null,
      customerName: parsed.customerName ?? null,
      address: parsed.address ?? null,
      notes: parsed.notes ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    // Flush reservation first so FK exists, then create assignments
    await em.begin()
    try {
      em.persist(reservation)
      await em.flush()
      await replaceAssignments(em, reservation, technicianIds)
      await em.flush()
      await em.commit()
    } catch (error) {
      await em.rollback()
      throw error
    }

    return { reservationId: reservation.id }
  },
  buildLog: async ({ result, ctx }) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadReservationSnapshot(em, result.reservationId)
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('technicianSchedule.audit.create', 'Create reservation'),
      resourceKind: 'technician_schedule.reservation',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies ReservationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as ReservationUndoPayload | undefined
    const after = payload?.after
    if (!after) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const reservation = await findOneWithDecryption(em, TechnicianReservation, { id: after.id })
    if (!reservation) return

    await withAtomicFlush(
      em,
      [
        () => {
          reservation.deletedAt = new Date()
          reservation.isActive = false
          reservation.updatedAt = new Date()
        },
        async () => {
          const assignments = await findWithDecryption(em, TechnicianReservationTechnician, { reservationId: reservation.id })
          assignments.forEach((assignment) => em.remove(assignment))
        },
      ],
      { transaction: true },
    )
  },
}

const updateReservationCommand: CommandHandler<TechnicianReservationUpdateInput, { reservationId: string }> = {
  id: 'technician_schedule.reservation.update',
  async prepare(rawInput, ctx) {
    const parsed = technicianReservationUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const before = await loadReservationSnapshot(em, parsed.id)
    if (!before) return {}
    return { before }
  },
  async execute(rawInput, ctx) {
    const parsed = technicianReservationUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const reservation = await requireReservationForMutation(em, ctx, parsed.id)
    const currentTechnicianIds = await listReservationTechnicianIds(em, reservation.id)
    const nextTechnicianIds = Array.from(new Set(parsed.technicianIds ?? currentTechnicianIds))
    const nextStartsAt = parsed.startsAt ? new Date(parsed.startsAt) : reservation.startsAt
    const nextEndsAt = parsed.endsAt ? new Date(parsed.endsAt) : reservation.endsAt

    const conflict = await checkReservationOverlap(em, {
      tenantId: reservation.tenantId,
      organizationId: reservation.organizationId,
      technicianIds: nextTechnicianIds,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      excludeReservationId: reservation.id,
    })

    if (conflict.hasConflict) {
      throw new CrudHttpError(409, {
        error: 'OVERLAP_CONFLICT',
        conflictingTechnicianIds: conflict.conflictingTechnicianIds,
      })
    }

    await withAtomicFlush(
      em,
      [
        () => {
          if (parsed.title !== undefined || parsed.reservationType !== undefined || parsed.customerName !== undefined) {
            reservation.title = buildReservationTitle({
              title: parsed.title ?? reservation.title,
              reservationType: parsed.reservationType ?? reservation.reservationType,
              customerName: parsed.customerName ?? reservation.customerName,
            })
          }
          if (parsed.reservationType !== undefined) reservation.reservationType = parsed.reservationType
          if (parsed.status !== undefined) reservation.status = parsed.status
          if (parsed.sourceType !== undefined) reservation.sourceType = parsed.sourceType
          if (parsed.sourceOrderId !== undefined) reservation.sourceOrderId = parsed.sourceOrderId ?? null
          if (parsed.startsAt !== undefined) reservation.startsAt = nextStartsAt
          if (parsed.endsAt !== undefined) reservation.endsAt = nextEndsAt
          if (parsed.vehicleId !== undefined) reservation.vehicleId = parsed.vehicleId ?? null
          if (parsed.vehicleLabel !== undefined) reservation.vehicleLabel = parsed.vehicleLabel ?? null
          if (parsed.customerName !== undefined) reservation.customerName = parsed.customerName ?? null
          if (parsed.address !== undefined) reservation.address = parsed.address ?? null
          if (parsed.notes !== undefined) reservation.notes = parsed.notes ?? null
          reservation.updatedAt = new Date()
        },
        async () => {
          if (parsed.technicianIds !== undefined) {
            await replaceAssignments(em, reservation, nextTechnicianIds)
          }
        },
      ],
      { transaction: true },
    )

    return { reservationId: reservation.id }
  },
  buildLog: async ({ snapshots, ctx }) => {
    const before = snapshots.before as ReservationSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadReservationSnapshot(em, before.id)
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('technicianSchedule.audit.update', 'Update reservation'),
      resourceKind: 'technician_schedule.reservation',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies ReservationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as ReservationUndoPayload | undefined
    const before = payload?.before
    if (!before) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let reservation = await findOneWithDecryption(em, TechnicianReservation, { id: before.id })
    if (!reservation) {
      reservation = em.create(TechnicianReservation, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        title: before.title,
        reservationType: before.reservationType,
        status: before.status,
        sourceType: before.sourceType,
        sourceOrderId: before.sourceOrderId,
        startsAt: new Date(before.startsAt),
        endsAt: new Date(before.endsAt),
        vehicleId: before.vehicleId,
        vehicleLabel: before.vehicleLabel,
        customerName: before.customerName,
        address: before.address,
        notes: before.notes,
        isActive: before.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: before.deletedAt ? new Date(before.deletedAt) : null,
      })
      em.persist(reservation)
    }

    await withAtomicFlush(
      em,
      [
        () => {
          applySnapshotToReservation(reservation, before)
        },
        async () => {
          await replaceAssignments(em, reservation, before.technicianIds)
        },
      ],
      { transaction: true },
    )
  },
}

const cancelReservationCommand: CommandHandler<CancelReservationInput, { reservationId: string }> = {
  id: 'technician_schedule.reservation.cancel',
  async prepare(rawInput, ctx) {
    const parsed = cancelReservationSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const before = await loadReservationSnapshot(em, parsed.id)
    if (!before) return {}
    return { before }
  },
  async execute(rawInput, ctx) {
    const parsed = cancelReservationSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const reservation = await requireReservationForMutation(em, ctx, parsed.id)

    if (reservation.status === 'cancelled') {
      throw new CrudHttpError(422, { error: 'Reservation already cancelled.' })
    }

    reservation.status = 'cancelled'
    if (parsed.notes !== undefined) reservation.notes = parsed.notes ?? null
    reservation.updatedAt = new Date()
    await em.flush()

    return { reservationId: reservation.id }
  },
  buildLog: async ({ snapshots, ctx }) => {
    const before = snapshots.before as ReservationSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadReservationSnapshot(em, before.id)
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('technicianSchedule.audit.cancel', 'Cancel reservation'),
      resourceKind: 'technician_schedule.reservation',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies ReservationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as ReservationUndoPayload | undefined
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const reservation = await findOneWithDecryption(em, TechnicianReservation, { id: before.id })
    if (!reservation) return
    applySnapshotToReservation(reservation, before)
    await em.flush()
  },
}

const deleteReservationCommand: CommandHandler<{ id: string }, { reservationId: string }> = {
  id: 'technician_schedule.reservation.delete',
  async prepare(input, ctx) {
    const id = typeof input?.id === 'string' ? input.id : null
    if (!id) throw new CrudHttpError(400, { error: 'Reservation id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const before = await loadReservationSnapshot(em, id)
    if (!before) return {}
    return { before }
  },
  async execute(input, ctx) {
    const id = typeof input?.id === 'string' ? input.id : null
    if (!id) throw new CrudHttpError(400, { error: 'Reservation id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const reservation = await requireReservationForMutation(em, ctx, id)
    reservation.deletedAt = new Date()
    reservation.isActive = false
    reservation.updatedAt = new Date()
    await em.flush()
    return { reservationId: reservation.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ReservationSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('technicianSchedule.audit.delete', 'Delete reservation'),
      resourceKind: 'technician_schedule.reservation',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies ReservationUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = logEntry?.payload?.undo as ReservationUndoPayload | undefined
    const before = payload?.before
    if (!before) return

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let reservation = await findOneWithDecryption(em, TechnicianReservation, { id: before.id })
    if (!reservation) {
      reservation = em.create(TechnicianReservation, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        title: before.title,
        reservationType: before.reservationType,
        status: before.status,
        sourceType: before.sourceType,
        sourceOrderId: before.sourceOrderId,
        startsAt: new Date(before.startsAt),
        endsAt: new Date(before.endsAt),
        vehicleId: before.vehicleId,
        vehicleLabel: before.vehicleLabel,
        customerName: before.customerName,
        address: before.address,
        notes: before.notes,
        isActive: before.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: before.deletedAt ? new Date(before.deletedAt) : null,
      })
      em.persist(reservation)
    }

    await withAtomicFlush(
      em,
      [
        () => {
          applySnapshotToReservation(reservation, before)
        },
        async () => {
          await replaceAssignments(em, reservation, before.technicianIds)
        },
      ],
      { transaction: true },
    )
  },
}

registerCommand(createReservationCommand)
registerCommand(updateReservationCommand)
registerCommand(cancelReservationCommand)
registerCommand(deleteReservationCommand)
