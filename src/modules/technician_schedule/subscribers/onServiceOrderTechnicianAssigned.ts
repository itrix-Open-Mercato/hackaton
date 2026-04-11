import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { CommandBus } from '@open-mercato/shared/lib/commands/command-bus'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { TechnicianReservation } from '../data/entities'

export const metadata = {
  id: 'technician_schedule.onServiceOrderTechnicianAssigned',
  event: 'service_orders.service_order.technician_assigned',
  persistent: true,
}

type ServiceOrderTechnicianAssignedPayload = {
  orderId: string
  technicianIds: string[]
  startsAt: string
  endsAt: string
  vehicleId?: string
  vehicleLabel?: string
  customerName?: string
  address?: string
  organizationId: string
  tenantId: string
}

function buildAutoTitle(payload: ServiceOrderTechnicianAssignedPayload): string {
  return payload.customerName?.trim()
    ? `Service order - ${payload.customerName.trim()}`
    : `Service order ${payload.orderId}`
}

export default async function onServiceOrderTechnicianAssigned(payload: ServiceOrderTechnicianAssignedPayload) {
  if (!payload?.orderId || !payload?.organizationId || !payload?.tenantId || !Array.isArray(payload.technicianIds) || payload.technicianIds.length === 0) {
    return
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const commandBus = container.resolve('commandBus') as CommandBus
  const eventBus = container.resolve('eventBus') as {
    emit: (eventId: string, body: Record<string, unknown>, options?: Record<string, unknown>) => Promise<void>
  }

  const existing = await em.findOne(TechnicianReservation, {
    sourceOrderId: payload.orderId,
    sourceType: 'service_order',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    deletedAt: null,
  })

  const ctx = {
    container,
    auth: null,
    organizationScope: null,
    selectedOrganizationId: payload.organizationId,
    organizationIds: [payload.organizationId],
  }

  try {
    if (existing) {
      await commandBus.execute('technician_schedule.reservation.update', {
        input: {
          id: existing.id,
          title: buildAutoTitle(payload),
          reservationType: 'client_visit',
          status: 'auto_confirmed',
          sourceType: 'service_order',
          sourceOrderId: payload.orderId,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          technicianIds: payload.technicianIds,
          vehicleId: payload.vehicleId ?? null,
          vehicleLabel: payload.vehicleLabel ?? null,
          customerName: payload.customerName ?? null,
          address: payload.address ?? null,
        },
        ctx,
      })
      return
    }

    await commandBus.execute('technician_schedule.reservation.create', {
      input: {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
        title: buildAutoTitle(payload),
        reservationType: 'client_visit',
        status: 'auto_confirmed',
        sourceType: 'service_order',
        sourceOrderId: payload.orderId,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        technicianIds: payload.technicianIds,
        vehicleId: payload.vehicleId ?? null,
        vehicleLabel: payload.vehicleLabel ?? null,
        customerName: payload.customerName ?? null,
        address: payload.address ?? null,
      },
      ctx,
    })
  } catch (error) {
    if (error instanceof CrudHttpError && error.status === 409) {
      console.warn('technician_schedule conflict detected for service order assignment', {
        orderId: payload.orderId,
        conflictingTechnicianIds: (error.body as { conflictingTechnicianIds?: string[] }).conflictingTechnicianIds ?? [],
      })
      await eventBus.emit('technician_schedule.reservation.conflict_detected', {
        orderId: payload.orderId,
        technicianIds: payload.technicianIds,
        conflictingTechnicianIds: (error.body as { conflictingTechnicianIds?: string[] }).conflictingTechnicianIds ?? [],
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      }, { persistent: true }).catch(() => undefined)
      return
    }

    throw error
  }
}
