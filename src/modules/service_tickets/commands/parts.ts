import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ServiceTicket, ServiceTicketPart } from '../data/entities'
import { partCreateSchema, partUpdateSchema } from '../data/validators'
import { ensureScope } from './tickets'

const createPartCommand: CommandHandler<Record<string, unknown>, ServiceTicketPart> = {
  id: 'service_tickets.parts.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = partCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const ticket = await em.findOne(ServiceTicket, {
      id: parsed.ticket_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceTicket>)
    if (!ticket) throw new CrudHttpError(404, { error: 'Service ticket not found' })

    const part = await de.createOrmEntity({
      entity: ServiceTicketPart,
      data: {
        ticket,
        productId: parsed.product_id,
        quantity: parsed.quantity,
        notes: parsed.notes ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return part
  },
}

const updatePartCommand: CommandHandler<Record<string, unknown>, ServiceTicketPart> = {
  id: 'service_tickets.parts.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = partUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const part = await de.updateOrmEntity({
      entity: ServiceTicketPart,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<ServiceTicketPart>,
      apply: (entity) => {
        if (parsed.quantity !== undefined) entity.quantity = parsed.quantity
        if (parsed.notes !== undefined) entity.notes = parsed.notes
      },
    })
    if (!part) throw new CrudHttpError(404, { error: 'Part not found' })

    return part
  },
}

const deletePartCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, ServiceTicketPart> = {
  id: 'service_tickets.parts.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Part id required')
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    const part = await em.findOne(ServiceTicketPart, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<ServiceTicketPart>)
    if (!part) throw new CrudHttpError(404, { error: 'Part not found' })

    em.remove(part)
    await em.flush()

    return part
  },
}

registerCommand(createPartCommand)
registerCommand(updatePartCommand)
registerCommand(deletePartCommand)
