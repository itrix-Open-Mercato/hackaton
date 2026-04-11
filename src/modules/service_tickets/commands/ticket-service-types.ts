import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ServiceTicket, ServiceTicketServiceType } from '../data/entities'

const assignCommand: CommandHandler<{ ticketId: string; machineServiceTypeId: string }, { id: string }> = {
  id: 'service_tickets.service_types.assign',
  async execute(input, ctx) {
    if (!input?.ticketId || !input?.machineServiceTypeId) {
      throw new CrudHttpError(400, { error: 'ticketId and machineServiceTypeId are required.' })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const ticket = await em.findOne(ServiceTicket, { id: input.ticketId, deletedAt: null })
    if (!ticket) throw new CrudHttpError(404, { error: 'Ticket not found.' })

    // Check for duplicate
    const existing = await em.findOne(ServiceTicketServiceType, {
      ticket: { id: input.ticketId },
      machineServiceTypeId: input.machineServiceTypeId,
    })
    if (existing) return { id: existing.id }

    const record = em.create(ServiceTicketServiceType, {
      tenantId: ticket.tenantId,
      organizationId: ticket.organizationId,
      ticket: em.getReference(ServiceTicket, input.ticketId),
      machineServiceTypeId: input.machineServiceTypeId,
    })
    em.persist(record)
    await em.flush()
    return { id: record.id }
  },
}

const unassignCommand: CommandHandler<{ id: string }, { ok: boolean }> = {
  id: 'service_tickets.service_types.unassign',
  async execute(input, ctx) {
    if (!input?.id) throw new CrudHttpError(400, { error: 'Assignment id is required.' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ServiceTicketServiceType, { id: input.id })
    if (!record) throw new CrudHttpError(404, { error: 'Assignment not found.' })
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

registerCommand(assignCommand)
registerCommand(unassignCommand)
