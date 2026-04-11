import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Technician, TechnicianAvailability } from '../data/entities'
import { availabilityCreateSchema, availabilityUpdateSchema, availabilityDeleteSchema } from '../data/validators'
import { ensureScope } from './technicians'

export const createAvailabilityCommand: CommandHandler<Record<string, unknown>, TechnicianAvailability> = {
  id: 'technicians.availability.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const technician = await em.findOne(Technician, {
      id: parsed.technician_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Technician>)
    if (!technician) throw new CrudHttpError(404, { error: 'Technician not found' })

    const availability = await de.createOrmEntity({
      entity: TechnicianAvailability,
      data: {
        technicianId: parsed.technician_id,
        date: parsed.date,
        dayType: parsed.day_type,
        notes: parsed.notes ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return availability
  },
}

export const updateAvailabilityCommand: CommandHandler<Record<string, unknown>, TechnicianAvailability> = {
  id: 'technicians.availability.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const availability = await de.updateOrmEntity({
      entity: TechnicianAvailability,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<TechnicianAvailability>,
      apply: (entity) => {
        if (parsed.day_type !== undefined) entity.dayType = parsed.day_type
        if (parsed.notes !== undefined) entity.notes = parsed.notes
      },
    })
    if (!availability) throw new CrudHttpError(404, { error: 'Availability record not found' })

    return availability
  },
}

export const deleteAvailabilityCommand: CommandHandler<Record<string, unknown>, { ok: boolean }> = {
  id: 'technicians.availability.delete',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = availabilityDeleteSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const availability = await de.updateOrmEntity({
      entity: TechnicianAvailability,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<TechnicianAvailability>,
      apply: (entity) => {
        entity.deletedAt = new Date()
      },
    })
    if (!availability) throw new CrudHttpError(404, { error: 'Availability record not found' })

    return { ok: true }
  },
}

registerCommand(createAvailabilityCommand)
registerCommand(updateAvailabilityCommand)
registerCommand(deleteAvailabilityCommand)
