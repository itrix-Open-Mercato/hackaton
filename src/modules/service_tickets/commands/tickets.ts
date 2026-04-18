import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { ServiceTicket, ServiceTicketAssignment, ServiceTicketDateChange, ServiceTicketServiceType } from '../data/entities'
import { ticketCreateSchema, ticketUpdateSchema } from '../data/validators'
import { emitServiceTicketEvent } from '../events'
import { ENTITY_TYPE } from '../lib/constants'
import { GoogleGeocodingAdapter } from '../lib/geocoding'
import { cancelTicketReservations, syncTicketReservations } from '../lib/ticketReservations'

// Module-level singleton — one instance per process, no DI overhead needed.
const geocodingAdapter = new GoogleGeocodingAdapter()

const MAX_TICKET_NUMBER_RETRIES = 3

export async function validateContactPersonBelongsToCompany(
  contactPersonId: string,
  customerEntityId: string,
  em: EntityManager,
): Promise<void> {
  const knex = (em as any).getConnection().getKnex()
  const rows = await knex('customer_people')
    .select('entity_id')
    .where({ company_entity_id: customerEntityId, entity_id: contactPersonId })
    .limit(1)
  if (!rows.length) {
    throw new CrudHttpError(422, {
      error: 'Contact person does not belong to the selected company',
      field: 'contact_person_id',
    })
  }
}

async function validateSalesChannelExists(
  salesChannelId: string,
  em: EntityManager,
  tenantId: string,
  organizationId: string,
): Promise<void> {
  const knex = (em as any).getConnection().getKnex()
  const row = await knex('sales_channels')
    .select('id')
    .where({
      id: salesChannelId,
      tenant_id: tenantId,
      organization_id: organizationId,
    })
    .whereNull('deleted_at')
    .first()
  if (!row) {
    throw new CrudHttpError(422, {
      error: 'Sales channel does not exist in the current organization',
      field: 'sales_channel_id',
    })
  }
}

export const ticketCrudEvents: CrudEventsConfig<ServiceTicket> = {
  module: 'service_tickets',
  entity: 'ticket',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<ServiceTicket>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const ticketCrudIndexer: CrudIndexerConfig<ServiceTicket> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<ServiceTicket>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<ServiceTicket>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

async function generateTicketNumber(em: EntityManager, tenantId: string, organizationId: string): Promise<string> {
  const knex = (em as any).getConnection().getKnex()
  const [row] = await knex('service_tickets')
    .max('ticket_number as max_num')
    .where({ tenant_id: tenantId, organization_id: organizationId })
  const maxNum = row?.max_num as string | null
  let next = 1
  if (maxNum) {
    const numPart = maxNum.replace('SRV-', '')
    const parsed = parseInt(numPart, 10)
    if (!isNaN(parsed)) next = parsed + 1
  }
  return `SRV-${next.toString().padStart(6, '0')}`
}

export const createTicketCommand: CommandHandler<Record<string, unknown>, ServiceTicket> = {
  id: 'service_tickets.tickets.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = ticketCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    if (parsed.contact_person_id && parsed.customer_entity_id) {
      await validateContactPersonBelongsToCompany(parsed.contact_person_id, parsed.customer_entity_id, em)
    } else if (parsed.contact_person_id && !parsed.customer_entity_id) {
      throw new CrudHttpError(422, {
        error: 'Contact person requires a company to be selected',
        field: 'contact_person_id',
      })
    }
    if (parsed.sales_channel_id) {
      await validateSalesChannelExists(parsed.sales_channel_id, em, scope.tenantId, scope.organizationId)
    }

    let ticket: ServiceTicket | null = null
    for (let attempt = 0; attempt < MAX_TICKET_NUMBER_RETRIES; attempt++) {
      const ticketNumber = await generateTicketNumber(em, scope.tenantId, scope.organizationId)
      try {
        ticket = await de.createOrmEntity({
          entity: ServiceTicket,
          data: {
            ticketNumber,
            serviceType: parsed.service_type,
            priority: parsed.priority,
            description: parsed.description ?? null,
            visitDate: parsed.visit_date ? new Date(parsed.visit_date) : null,
            visitEndDate: parsed.visit_end_date ? new Date(parsed.visit_end_date) : null,
            address: parsed.address ?? null,
            customerEntityId: parsed.customer_entity_id ?? null,
            contactPersonId: parsed.customer_entity_id ? parsed.contact_person_id ?? null : null,
            machineInstanceId: parsed.machine_instance_id ?? null,
            orderId: parsed.order_id ?? null,
            salesChannelId: parsed.sales_channel_id ?? null,
            createdByUserId: ctx.auth?.userId ?? null,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
          },
        })
        break
      } catch (error: unknown) {
        const isUniqueViolation =
          error instanceof Error &&
          (error.message.includes('unique') || error.message.includes('duplicate') || error.message.includes('23505'))
        if (!isUniqueViolation || attempt === MAX_TICKET_NUMBER_RETRIES - 1) throw error
        em.clear()
      }
    }
    if (!ticket) throw new CrudHttpError(500, { error: 'Failed to generate ticket number' })

    // Geocode the address if provided and no manual coordinates were supplied
    if (parsed.address && parsed.latitude == null && parsed.longitude == null) {
      const geo = await geocodingAdapter.geocode(parsed.address)
      if (geo) {
        await de.updateOrmEntity({
          entity: ServiceTicket,
          where: { id: ticket.id } as import('@mikro-orm/postgresql').FilterQuery<ServiceTicket>,
          apply: (e) => {
            e.latitude = geo.latitude
            e.longitude = geo.longitude
            e.locationSource = 'geocoded'
            e.geocodedAddress = geo.normalizedAddress
            e.locationUpdatedAt = new Date()
          },
        })
        ticket.latitude = geo.latitude
        ticket.longitude = geo.longitude
        ticket.locationSource = 'geocoded'
        ticket.geocodedAddress = geo.normalizedAddress
        ticket.locationUpdatedAt = new Date()
      }
    } else if (parsed.latitude != null && parsed.longitude != null) {
      await de.updateOrmEntity({
        entity: ServiceTicket,
        where: { id: ticket.id } as import('@mikro-orm/postgresql').FilterQuery<ServiceTicket>,
        apply: (e) => {
          e.latitude = parsed.latitude!
          e.longitude = parsed.longitude!
          e.locationSource = parsed.location_source ?? 'manual'
          e.locationUpdatedAt = new Date()
        },
      })
    }

    if (parsed.staff_member_ids?.length) {
      for (const staffMemberId of parsed.staff_member_ids) {
        await de.createOrmEntity({
          entity: ServiceTicketAssignment,
          data: {
            ticket,
            staffMemberId,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
          },
        })
      }
    }

    if (parsed.machine_service_type_ids?.length) {
      for (const machineServiceTypeId of parsed.machine_service_type_ids) {
        await de.createOrmEntity({
          entity: ServiceTicketServiceType,
          data: {
            ticket,
            machineServiceTypeId,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
          },
        })
      }
    }

    await syncTicketReservations({
      em,
      ticket,
      staffMemberIds: parsed.staff_member_ids ?? [],
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: ticket,
      identifiers: {
        id: String(ticket.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: ticketCrudEvents,
      indexer: ticketCrudIndexer,
    })

    return ticket
  },
}

export const updateTicketCommand: CommandHandler<Record<string, unknown>, ServiceTicket> = {
  id: 'service_tickets.tickets.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = ticketUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceTicket, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceTicket>)
    if (!existing) throw new CrudHttpError(404, { error: 'Service ticket not found' })

    const companyChanging =
      parsed.customer_entity_id !== undefined &&
      parsed.customer_entity_id !== existing.customerEntityId
    const effectiveCompanyId = parsed.customer_entity_id !== undefined ? parsed.customer_entity_id : existing.customerEntityId
    // When company changes without an explicit contact_person_id, the apply function will
    // clear the contact person — skip validation in that case.
    const effectivePersonId = parsed.contact_person_id !== undefined
      ? parsed.contact_person_id
      : (companyChanging ? null : existing.contactPersonId)
    if (effectivePersonId && effectiveCompanyId) {
      await validateContactPersonBelongsToCompany(effectivePersonId, effectiveCompanyId, em)
    } else if (effectivePersonId && !effectiveCompanyId) {
      throw new CrudHttpError(422, {
        error: 'Contact person requires a company to be selected',
        field: 'contact_person_id',
      })
    }
    if (parsed.sales_channel_id) {
      await validateSalesChannelExists(parsed.sales_channel_id, em, scope.tenantId, scope.organizationId)
    }

    const oldVisitDate = existing.visitDate
    const oldStatus = existing.status

    const addressChanged =
      parsed.address !== undefined && parsed.address !== existing.address
    const manualCoordsProvided = parsed.latitude != null && parsed.longitude != null

    const ticket = await de.updateOrmEntity({
      entity: ServiceTicket,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ServiceTicket>,
      apply: (entity) => {
        const companyChanged =
          parsed.customer_entity_id !== undefined &&
          parsed.customer_entity_id !== entity.customerEntityId

        if (parsed.service_type !== undefined) entity.serviceType = parsed.service_type
        if (parsed.status !== undefined) entity.status = parsed.status
        if (parsed.priority !== undefined) entity.priority = parsed.priority
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.visit_date !== undefined) entity.visitDate = parsed.visit_date ? new Date(parsed.visit_date) : null
        if (parsed.visit_end_date !== undefined) entity.visitEndDate = parsed.visit_end_date ? new Date(parsed.visit_end_date) : null
        if (parsed.address !== undefined) entity.address = parsed.address
        if (parsed.customer_entity_id !== undefined) entity.customerEntityId = parsed.customer_entity_id
        if (parsed.contact_person_id !== undefined) {
          entity.contactPersonId = parsed.contact_person_id
        } else if (companyChanged) {
          entity.contactPersonId = null
        }
        if (parsed.machine_instance_id !== undefined) entity.machineInstanceId = parsed.machine_instance_id
        if (parsed.order_id !== undefined) entity.orderId = parsed.order_id
        if (parsed.sales_channel_id !== undefined) entity.salesChannelId = parsed.sales_channel_id

        // Clear location when address is explicitly nulled
        if (parsed.address === null) {
          entity.latitude = null
          entity.longitude = null
          entity.locationSource = null
          entity.geocodedAddress = null
          entity.locationUpdatedAt = null
        }

        // Apply manual coordinate override
        if (manualCoordsProvided) {
          entity.latitude = parsed.latitude!
          entity.longitude = parsed.longitude!
          entity.locationSource = parsed.location_source ?? 'manual'
          entity.locationUpdatedAt = new Date()
        }
      },
    })
    if (!ticket) throw new CrudHttpError(404, { error: 'Service ticket not found' })

    // Re-geocode when address changed and no manual coordinates provided
    if (addressChanged && !manualCoordsProvided && parsed.address) {
      const geo = await geocodingAdapter.geocode(parsed.address)
      if (geo) {
        await de.updateOrmEntity({
          entity: ServiceTicket,
          where: { id: parsed.id } as FilterQuery<ServiceTicket>,
          apply: (e) => {
            e.latitude = geo.latitude
            e.longitude = geo.longitude
            e.locationSource = 'geocoded'
            e.geocodedAddress = geo.normalizedAddress
            e.locationUpdatedAt = new Date()
          },
        })
        ticket.latitude = geo.latitude
        ticket.longitude = geo.longitude
        ticket.locationSource = 'geocoded'
        ticket.geocodedAddress = geo.normalizedAddress
        ticket.locationUpdatedAt = new Date()
      }
    }

    const dateChanged = String(oldVisitDate ?? '') !== String(ticket.visitDate ?? '')
    if (dateChanged) {
      await de.createOrmEntity({
        entity: ServiceTicketDateChange,
        data: {
          ticket,
          oldDate: oldVisitDate ?? null,
          newDate: ticket.visitDate ?? null,
          changedByUserId: ctx.auth?.userId ?? null,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        },
      })
    }

    if (parsed.staff_member_ids) {
      const currentAssignments = await em.find(ServiceTicketAssignment, {
        ticket: { id: parsed.id },
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<ServiceTicketAssignment>)
      const existingIds = new Set(currentAssignments.map((a) => a.staffMemberId))
      const wantedIds = new Set(parsed.staff_member_ids)

      for (const assignment of currentAssignments) {
        if (!wantedIds.has(assignment.staffMemberId)) {
          em.remove(assignment)
        }
      }

      for (const staffMemberId of parsed.staff_member_ids) {
        if (!existingIds.has(staffMemberId)) {
          await de.createOrmEntity({
            entity: ServiceTicketAssignment,
            data: {
              ticket,
              staffMemberId,
              tenantId: scope.tenantId,
              organizationId: scope.organizationId,
            },
          })
        }
      }

      await em.flush()
    }

    if (parsed.machine_service_type_ids) {
      const currentServiceTypes = await em.find(ServiceTicketServiceType, {
        ticket: { id: parsed.id },
      } as FilterQuery<ServiceTicketServiceType>)
      const existingStIds = new Set(currentServiceTypes.map((s) => s.machineServiceTypeId))
      const wantedStIds = new Set(parsed.machine_service_type_ids)

      for (const st of currentServiceTypes) {
        if (!wantedStIds.has(st.machineServiceTypeId)) {
          em.remove(st)
        }
      }

      for (const machineServiceTypeId of parsed.machine_service_type_ids) {
        if (!existingStIds.has(machineServiceTypeId)) {
          await de.createOrmEntity({
            entity: ServiceTicketServiceType,
            data: {
              ticket,
              machineServiceTypeId,
              tenantId: scope.tenantId,
              organizationId: scope.organizationId,
            },
          })
        }
      }

      await em.flush()
    }

    const reservationAssignmentIds = parsed.staff_member_ids ?? (
      await em.find(ServiceTicketAssignment, {
        ticket: { id: parsed.id },
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<ServiceTicketAssignment>)
    ).map((assignment) => assignment.staffMemberId)

    await syncTicketReservations({
      em,
      ticket,
      staffMemberIds: reservationAssignmentIds,
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: ticket,
      identifiers: {
        id: String(ticket.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: ticketCrudEvents,
      indexer: ticketCrudIndexer,
    })

    const statusChanged = oldStatus !== ticket.status
    if (statusChanged) {
      await emitServiceTicketEvent('service_tickets.ticket.status_changed', {
        id: String(ticket.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        oldStatus,
        newStatus: ticket.status,
      })
    }

    return ticket
  },
}

export const deleteTicketCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, ServiceTicket> = {
  id: 'service_tickets.tickets.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Service ticket id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const ticket = await de.deleteOrmEntity({
      entity: ServiceTicket,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ServiceTicket>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!ticket) throw new CrudHttpError(404, { error: 'Service ticket not found' })

    await cancelTicketReservations({
      em: ctx.container.resolve('em') as EntityManager,
      ticketId: id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: ticket,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: ticketCrudEvents,
      indexer: ticketCrudIndexer,
    })

    return ticket
  },
}

registerCommand(createTicketCommand)
registerCommand(updateTicketCommand)
registerCommand(deleteTicketCommand)
