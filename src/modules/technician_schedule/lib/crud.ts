import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { TechnicianReservation, TechnicianReservationTechnician } from '../data/entities'

function buildCrudEvents<TEntity>(entity: string): CrudEventsConfig<TEntity> {
  return {
    module: 'technician_schedule',
    entity,
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const technicianReservationCrudEvents = buildCrudEvents<TechnicianReservation>('reservation')
export const technicianReservationTechnicianCrudEvents = buildCrudEvents<TechnicianReservationTechnician>('reservation_technician')

export const TECHNICIAN_SCHEDULE_RESERVATION_ENTITY_TYPE = 'technician_schedule:technician_reservation'
export const TECHNICIAN_SCHEDULE_ASSIGNMENT_ENTITY_TYPE = 'technician_schedule:technician_reservation_technician'
