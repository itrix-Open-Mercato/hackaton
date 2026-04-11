import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import {
  ServiceProtocol,
  ServiceProtocolTechnician,
  ServiceProtocolPart,
  ServiceProtocolHistory,
} from '../data/entities'
import {
  createProtocolFromTicketSchema,
  updateProtocolSchema,
  submitSchema,
  rejectSchema,
  approveSchema,
  closeSchema,
  cancelSchema,
  unlockSchema,
} from '../data/validators'
import { emitProtocolEvent } from '../events'

// We use raw Knex for cross-module queries to avoid entity imports across modules
// (Turbopack CJS-async constraint).

export function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

async function generateProtocolNumber(em: EntityManager, tenantId: string, organizationId: string): Promise<string> {
  const knex = (em as any).getConnection().getKnex()
  const year = new Date().getFullYear()
  const prefix = `PROT-${year}-`
  const [row] = await knex('service_protocols')
    .max('protocol_number as max_num')
    .where({ tenant_id: tenantId, organization_id: organizationId })
    .where('protocol_number', 'like', `${prefix}%`)
  const maxNum = row?.max_num as string | null
  let next = 1
  if (maxNum) {
    const numPart = maxNum.replace(prefix, '')
    const parsed = parseInt(numPart, 10)
    if (!isNaN(parsed)) next = parsed + 1
  }
  return `${prefix}${next.toString().padStart(4, '0')}`
}

function buildCostSummary(
  technicians: ServiceProtocolTechnician[],
  parts: ServiceProtocolPart[],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  for (const t of technicians) {
    if (Number(t.hoursWorked) > 0) {
      rows.push({
        sourceType: 'labor',
        sourceLineId: t.id,
        label: `Technician labor (${t.staffMemberId})`,
        quantity: Number(t.hoursWorked),
        unit: 'h',
        unitAmount: t.hourlyRateSnapshot ?? null,
        totalAmount: t.hourlyRateSnapshot != null ? Number(t.hoursWorked) * Number(t.hourlyRateSnapshot) : null,
        billable: t.isBillable,
        internalOnly: false,
      })
    }
    if (Number(t.kmDriven) > 0) {
      rows.push({
        sourceType: 'travel_km',
        sourceLineId: t.id,
        label: `Travel km (${t.staffMemberId})`,
        quantity: Number(t.kmDriven),
        unit: 'km',
        unitAmount: t.kmRateSnapshot ?? null,
        totalAmount: t.kmRateSnapshot != null ? Number(t.kmDriven) * Number(t.kmRateSnapshot) : null,
        billable: t.kmIsBillable,
        internalOnly: false,
      })
    }
    if (Number(t.delegationDays) > 0) {
      rows.push({
        sourceType: 'delegation',
        sourceLineId: t.id,
        label: `Delegation days (${t.staffMemberId})`,
        quantity: Number(t.delegationDays),
        unit: 'day',
        unitAmount: t.dietRateSnapshot ?? null,
        totalAmount: t.dietRateSnapshot != null ? Number(t.delegationDays) * Number(t.dietRateSnapshot) : null,
        billable: false,
        internalOnly: true,
      })
    }
    if (t.hotelAmount != null && Number(t.hotelAmount) > 0) {
      rows.push({
        sourceType: 'hotel',
        sourceLineId: t.id,
        label: `Hotel (${t.hotelInvoiceRef ?? t.staffMemberId})`,
        quantity: 1,
        unit: 'night',
        unitAmount: Number(t.hotelAmount),
        totalAmount: Number(t.hotelAmount),
        billable: false,
        internalOnly: true,
      })
    }
  }

  for (const p of parts) {
    if (p.lineStatus !== 'removed') {
      rows.push({
        sourceType: 'part',
        sourceLineId: p.id,
        label: p.nameSnapshot,
        quantity: Number(p.quantityUsed),
        unit: p.unit ?? 'pcs',
        unitAmount: p.unitPriceSnapshot ?? null,
        totalAmount: p.unitPriceSnapshot != null ? Number(p.quantityUsed) * Number(p.unitPriceSnapshot) : null,
        billable: p.isBillable,
        internalOnly: false,
      })
    }
  }

  return rows
}

// --- create_from_ticket ---

export const createProtocolFromTicketCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.create_from_ticket',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createProtocolFromTicketSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Read source ticket via raw Knex (cross-module boundary)
    const [ticket] = await knex('service_tickets')
      .select('*')
      .where({
        id: parsed.service_ticket_id,
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        deleted_at: null,
      })
      .limit(1)

    if (!ticket) throw new CrudHttpError(404, { error: 'Service ticket not found' })
    if (['new', 'cancelled'].includes(ticket.status)) {
      throw new CrudHttpError(422, {
        error: `Cannot create protocol from a ticket with status '${ticket.status}'`,
        field: 'service_ticket_id',
      })
    }

    // Check at least one assignment
    const assignments = await knex('service_ticket_assignments')
      .select('id', 'staff_member_id')
      .where({ ticket_id: parsed.service_ticket_id })

    if (!assignments.length) {
      throw new CrudHttpError(422, {
        error: 'Cannot create protocol from a ticket without assigned technicians',
        field: 'service_ticket_id',
      })
    }

    // Check no active protocol exists for this ticket
    const existing = await em.findOne(ServiceProtocol, {
      serviceTicketId: parsed.service_ticket_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      status: { $nin: ['cancelled'] },
    } as FilterQuery<ServiceProtocol>)

    if (existing) {
      throw new CrudHttpError(422, {
        error: 'An active protocol already exists for this ticket',
        field: 'service_ticket_id',
      })
    }

    const protocolNumber = await generateProtocolNumber(em, scope.tenantId, scope.organizationId)

    const protocol = await de.createOrmEntity({
      entity: ServiceProtocol,
      data: {
        serviceTicketId: parsed.service_ticket_id,
        protocolNumber,
        status: 'draft' as const,
        type: 'standard' as const,
        customerEntityId: ticket.customer_entity_id ?? null,
        contactPersonId: ticket.contact_person_id ?? null,
        machineAssetId: ticket.machine_instance_id ?? null,
        ticketDescriptionSnapshot: ticket.description ?? null,
        plannedVisitDateSnapshot: ticket.visit_date ? new Date(ticket.visit_date) : null,
        plannedVisitEndDateSnapshot: ticket.visit_end_date ? new Date(ticket.visit_end_date) : null,
        serviceAddressSnapshot: ticket.address ? { address: ticket.address } : null,
        isActive: true,
        completedTicketOnClose: false,
        createdByUserId: ctx.auth?.userId ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    // Create one technician line per assignment
    for (const assignment of assignments) {
      await de.createOrmEntity({
        entity: ServiceProtocolTechnician,
        data: {
          protocol,
          staffMemberId: assignment.staff_member_id,
          hoursWorked: 0,
          isBillable: false,
          kmDriven: 0,
          kmIsBillable: false,
          delegationDays: 0,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        },
      })
    }

    // Create one part line per proposed ticket part
    const parts = await knex('service_ticket_parts')
      .select('*')
      .where({ ticket_id: parsed.service_ticket_id })

    for (const part of parts) {
      // Look up product name/code if available
      let nameSnapshot = `Product ${part.product_id}`
      let partCodeSnapshot: string | null = null
      try {
        const [product] = await knex('catalog_products')
          .select('name', 'sku')
          .where({ id: part.product_id })
          .limit(1)
        if (product) {
          nameSnapshot = product.name ?? nameSnapshot
          partCodeSnapshot = product.sku ?? null
        }
      } catch {
        // Product not found — use fallback name
      }

      await de.createOrmEntity({
        entity: ServiceProtocolPart,
        data: {
          protocol,
          catalogProductId: part.product_id ?? null,
          nameSnapshot,
          partCodeSnapshot,
          quantityProposed: Number(part.quantity ?? 0),
          quantityUsed: 0,
          unit: null,
          isBillable: false,
          lineStatus: 'proposed' as const,
          notes: part.notes ?? null,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        },
      })
    }

    // History entry
    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'created_from_ticket' as const,
        newValue: { serviceTicketId: parsed.service_ticket_id, protocolNumber },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.created', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- update ---

export const updateProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = updateProtocolSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })

    if (existing.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot edit a closed protocol. Use unlock first.' })
    }

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    const isApprovedOrClosed = ['approved', 'closed'].includes(existing.status)

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<ServiceProtocol>,
      apply: (e) => {
        // Always editable
        if (parsed.work_description !== undefined) e.workDescription = parsed.work_description
        if (parsed.technician_notes !== undefined) e.technicianNotes = parsed.technician_notes
        if (parsed.customer_notes !== undefined) e.customerNotes = parsed.customer_notes

        // Coordinator-only header snapshot fields (only when not approved/closed)
        if (isCoordinator && !isApprovedOrClosed) {
          if (parsed.customer_entity_id !== undefined) e.customerEntityId = parsed.customer_entity_id
          if (parsed.contact_person_id !== undefined) e.contactPersonId = parsed.contact_person_id
          if (parsed.machine_asset_id !== undefined) e.machineAssetId = parsed.machine_asset_id
          if (parsed.service_address_snapshot !== undefined) e.serviceAddressSnapshot = parsed.service_address_snapshot
          if (parsed.ticket_description_snapshot !== undefined) e.ticketDescriptionSnapshot = parsed.ticket_description_snapshot
          if (parsed.planned_visit_date_snapshot !== undefined) {
            e.plannedVisitDateSnapshot = parsed.planned_visit_date_snapshot ? new Date(parsed.planned_visit_date_snapshot) : null
          }
          if (parsed.planned_visit_end_date_snapshot !== undefined) {
            e.plannedVisitEndDateSnapshot = parsed.planned_visit_end_date_snapshot ? new Date(parsed.planned_visit_end_date_snapshot) : null
          }
          if (parsed.type !== undefined) e.type = parsed.type
        }
      },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'field_edit' as const,
        newValue: { updatedFields: Object.keys(parsed).filter((k) => k !== 'id') },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.updated', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- submit ---

export const submitProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.submit',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = submitSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status !== 'draft') {
      throw new CrudHttpError(422, { error: `Cannot submit from status '${existing.status}'` })
    }

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => { e.status = 'in_review' },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'status_change' as const,
        oldValue: { status: 'draft' },
        newValue: { status: 'in_review' },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.submitted', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- reject ---

export const rejectProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.reject',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = rejectSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    if (!isCoordinator) throw new CrudHttpError(403, { error: 'Coordinator permission required to reject' })

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status !== 'in_review') {
      throw new CrudHttpError(422, { error: `Cannot reject from status '${existing.status}'` })
    }

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => { e.status = 'draft' },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'rejected' as const,
        oldValue: { status: 'in_review' },
        newValue: { status: 'draft' },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        notes: parsed.notes,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.rejected', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- approve ---

export const approveProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.approve',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = approveSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    if (!isCoordinator) throw new CrudHttpError(403, { error: 'Coordinator permission required to approve' })

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status !== 'in_review') {
      throw new CrudHttpError(422, { error: `Cannot approve from status '${existing.status}'` })
    }

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => { e.status = 'approved' },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'approved' as const,
        oldValue: { status: 'in_review' },
        newValue: { status: 'approved' },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.approved', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- close ---

export const closeProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.close',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = closeSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    const canClose = ctx.auth?.features?.includes('service_protocols.close') ?? false
    if (!isCoordinator && !canClose) throw new CrudHttpError(403, { error: 'Permission required to close protocol' })

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status !== 'approved') {
      throw new CrudHttpError(422, { error: `Cannot close from status '${existing.status}'` })
    }

    // Validate work_description non-empty
    if (!existing.workDescription?.trim()) {
      throw new CrudHttpError(422, { error: 'Work description must be provided before closing', field: 'work_description' })
    }

    // Get technicians
    const technicians = await em.find(ServiceProtocolTechnician, {
      protocol: { id: parsed.id },
      deletedAt: null,
    } as FilterQuery<ServiceProtocolTechnician>)

    const hasHours = technicians.some((t) => Number(t.hoursWorked) > 0)
    if (!hasHours) {
      throw new CrudHttpError(422, { error: 'At least one technician must have hours worked > 0 before closing' })
    }

    // Get parts — no proposed lines allowed
    const parts = await em.find(ServiceProtocolPart, {
      protocol: { id: parsed.id },
      deletedAt: null,
    } as FilterQuery<ServiceProtocolPart>)

    const hasProposed = parts.some((p) => p.lineStatus === 'proposed')
    if (hasProposed) {
      throw new CrudHttpError(422, { error: 'All part lines must be confirmed, added, or removed before closing' })
    }

    const costSummary = buildCostSummary(technicians, parts)

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => {
        e.status = 'closed'
        e.closedAt = new Date()
        e.closedByUserId = ctx.auth?.userId ?? null
        e.completedTicketOnClose = parsed.complete_service_ticket
        e.preparedCostSummary = costSummary
        e.isActive = false
      },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'closed' as const,
        oldValue: { status: 'approved' },
        newValue: { status: 'closed', completeServiceTicket: parsed.complete_service_ticket },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    // If requested, update the linked service ticket to 'completed' via raw Knex
    if (parsed.complete_service_ticket) {
      const knex = (em as any).getConnection().getKnex()
      await knex('service_tickets')
        .where({
          id: existing.serviceTicketId,
          tenant_id: scope.tenantId,
          organization_id: scope.organizationId,
        })
        .whereNot({ status: 'cancelled' })
        .update({ status: 'completed', updated_at: new Date() })
    }

    await emitProtocolEvent('service_protocols.protocol.closed', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      completedServiceTicket: parsed.complete_service_ticket,
    })

    return protocol
  },
}

// --- cancel ---

export const cancelProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.cancel',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = cancelSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status === 'closed') {
      throw new CrudHttpError(422, { error: 'Cannot cancel a closed protocol' })
    }

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => {
        e.status = 'cancelled'
        e.isActive = false
      },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'cancelled' as const,
        oldValue: { status: existing.status },
        newValue: { status: 'cancelled' },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        notes: parsed.notes ?? undefined,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.cancelled', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

// --- unlock ---

export const unlockProtocolCommand: CommandHandler<Record<string, unknown>, ServiceProtocol> = {
  id: 'service_protocols.protocols.unlock',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = unlockSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const isCoordinator = ctx.auth?.features?.includes('service_protocols.manage') ?? false
    if (!isCoordinator) throw new CrudHttpError(403, { error: 'Coordinator permission required to unlock' })

    const existing = await em.findOne(ServiceProtocol, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<ServiceProtocol>)
    if (!existing) throw new CrudHttpError(404, { error: 'Protocol not found' })
    if (existing.status !== 'closed') {
      throw new CrudHttpError(422, { error: `Cannot unlock from status '${existing.status}'` })
    }

    const protocol = await de.updateOrmEntity({
      entity: ServiceProtocol,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<ServiceProtocol>,
      apply: (e) => {
        e.status = 'approved'
        e.isActive = true
      },
    })
    if (!protocol) throw new CrudHttpError(404, { error: 'Protocol not found' })

    await de.createOrmEntity({
      entity: ServiceProtocolHistory,
      data: {
        protocol,
        eventType: 'unlocked' as const,
        oldValue: { status: 'closed' },
        newValue: { status: 'approved' },
        performedByUserId: ctx.auth?.userId ?? null,
        performedAt: new Date(),
        notes: parsed.notes,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitProtocolEvent('service_protocols.protocol.unlocked', {
      id: String(protocol.id),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return protocol
  },
}

registerCommand(createProtocolFromTicketCommand)
registerCommand(updateProtocolCommand)
registerCommand(submitProtocolCommand)
registerCommand(rejectProtocolCommand)
registerCommand(approveProtocolCommand)
registerCommand(closeProtocolCommand)
registerCommand(cancelProtocolCommand)
registerCommand(unlockProtocolCommand)
