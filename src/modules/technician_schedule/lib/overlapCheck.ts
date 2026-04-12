import type { EntityManager } from '@mikro-orm/postgresql'

type OverlapCheckInput = {
  tenantId: string
  organizationId: string
  technicianIds: string[]
  startsAt: Date
  endsAt: Date
  excludeReservationId?: string | null
}

export type OverlapCheckResult = {
  hasConflict: boolean
  conflictingTechnicianIds: string[]
}

export async function checkReservationOverlap(
  em: EntityManager,
  input: OverlapCheckInput,
): Promise<OverlapCheckResult> {
  const technicianIds = Array.from(new Set(input.technicianIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))
  if (technicianIds.length === 0) {
    return { hasConflict: false, conflictingTechnicianIds: [] }
  }

  const placeholders = technicianIds.map(() => '?').join(', ')
  const params: unknown[] = [
    input.tenantId,
    input.organizationId,
    ...technicianIds,
    input.endsAt,
    input.startsAt,
  ]

  let sql = `
    select distinct trt.technician_id
    from technician_reservation_technicians trt
    inner join technician_reservations tr on tr.id = trt.reservation_id
    where trt.tenant_id = ?
      and trt.organization_id = ?
      and trt.technician_id in (${placeholders})
      and tr.deleted_at is null
      and tr.status <> 'cancelled'
      and tr.starts_at < ?
      and tr.ends_at > ?
  `

  if (input.excludeReservationId) {
    sql += ' and tr.id <> ?'
    params.push(input.excludeReservationId)
  }

  type Row = { technician_id?: string | null }
  const rows = await em.getConnection().execute<Row[]>(sql, params)
  const conflictingTechnicianIds = rows
    .map((row) => (typeof row.technician_id === 'string' ? row.technician_id : null))
    .filter((value): value is string => value !== null)

  return {
    hasConflict: conflictingTechnicianIds.length > 0,
    conflictingTechnicianIds,
  }
}

export function createOverlapCheck({ em }: { em: EntityManager }) {
  return (input: OverlapCheckInput) => checkReservationOverlap(em, input)
}
