import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { FieldTechnician, FieldTechnicianCertification } from '../data/entities'

function buildCrudEvents<TEntity>(entity: string): CrudEventsConfig<TEntity> {
  return {
    module: 'field_technicians',
    entity,
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const fieldTechnicianCrudEvents = buildCrudEvents<FieldTechnician>('field_technician')
export const fieldTechnicianCertificationCrudEvents = buildCrudEvents<FieldTechnicianCertification>('certification')

export const FIELD_TECHNICIAN_ENTITY_TYPE = 'field_technicians:field_technician'
export const FIELD_TECHNICIAN_CERT_ENTITY_TYPE = 'field_technicians:field_technician_certification'
