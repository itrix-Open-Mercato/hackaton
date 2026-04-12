"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ServiceTypeDetail = {
  id: string
  serviceType: string
  defaultTeamSize: number | null
  defaultServiceDurationMinutes: number | null
  startupNotes: string | null
  serviceNotes: string | null
  skills: string[]
  certifications: string[]
  parts: Array<{ catalogProductId: string; productLabel: string | null; quantity: number }>
}

type Assignment = {
  id: string
  machineServiceTypeId: string
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v)
  return s.length > 0 ? s : null
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ServiceTypeAccordion({
  detail,
  assigned,
  assignmentId,
  onToggle,
  toggling,
}: {
  detail: ServiceTypeDetail
  assigned: boolean
  assignmentId: string | null
  onToggle: (serviceTypeId: string, assignmentId: string | null) => void
  toggling: boolean
}) {
  const t = useT()
  const [expanded, setExpanded] = React.useState(assigned)

  return (
    <div className={`rounded-lg border ${assigned ? 'border-primary/40 bg-primary/5' : 'bg-card'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          className="flex-1 flex items-center gap-3 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${assigned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {detail.serviceType}
          </span>
          {detail.defaultTeamSize != null && (
            <span className="text-xs text-muted-foreground">Team: {detail.defaultTeamSize}</span>
          )}
          {detail.defaultServiceDurationMinutes != null && (
            <span className="text-xs text-muted-foreground">{detail.defaultServiceDurationMinutes} min</span>
          )}
          {detail.skills.length > 0 && (
            <span className="text-xs text-muted-foreground">{detail.skills.length} skill(s)</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{expanded ? '▲' : '▼'}</span>
        </button>
        <Button
          type="button"
          size="sm"
          variant={assigned ? 'destructive' : 'default'}
          onClick={() => onToggle(detail.id, assignmentId)}
          disabled={toggling}
          className="ml-3 shrink-0"
        >
          {toggling ? '...' : assigned
            ? t('service_tickets.serviceTypes.unassign', 'Remove')
            : t('service_tickets.serviceTypes.assign', 'Assign')}
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <ReadOnlyField label={t('service_tickets.serviceTypes.fields.teamSize', 'Team size')} value={detail.defaultTeamSize} />
            <ReadOnlyField label={t('service_tickets.serviceTypes.fields.duration', 'Duration')} value={detail.defaultServiceDurationMinutes != null ? `${detail.defaultServiceDurationMinutes} min` : null} />
            <ReadOnlyField label={t('service_tickets.serviceTypes.fields.startupNotes', 'Startup notes')} value={detail.startupNotes} />
            <ReadOnlyField label={t('service_tickets.serviceTypes.fields.serviceNotes', 'Service notes')} value={detail.serviceNotes} />
          </div>

          {detail.skills.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">{t('service_tickets.serviceTypes.fields.skills', 'Required skills')}:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {detail.skills.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">{s}</span>
                ))}
              </div>
            </div>
          )}

          {detail.certifications.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">{t('service_tickets.serviceTypes.fields.certifications', 'Required certifications')}:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {detail.certifications.map((c) => (
                  <span key={c} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{c}</span>
                ))}
              </div>
            </div>
          )}

          {detail.parts.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">{t('service_tickets.serviceTypes.fields.parts', 'Required parts')}:</span>
              <div className="mt-1 space-y-0.5">
                {detail.parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{p.productLabel || p.catalogProductId}</span>
                    <span className="text-muted-foreground">x{p.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.skills.length === 0 && detail.certifications.length === 0 && detail.parts.length === 0 && detail.startupNotes == null && detail.serviceNotes == null && detail.defaultTeamSize == null && detail.defaultServiceDurationMinutes == null && (
            <p className="text-xs text-muted-foreground">{t('service_tickets.serviceTypes.noDetails', 'No details configured for this service type.')}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ServiceTypeAssignments({
  ticketId,
  machineInstanceId,
}: {
  ticketId: string
  machineInstanceId: string | null
}) {
  const t = useT()
  const [serviceTypes, setServiceTypes] = React.useState<ServiceTypeDetail[]>([])
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!machineInstanceId) {
      setServiceTypes([])
      setAssignments([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 1. Get machine instance to find catalog product
      const instRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
        `/api/machine_instances/machines?ids=${encodeURIComponent(machineInstanceId)}&pageSize=1`,
        undefined,
        { fallback: { items: [] } },
      )
      const inst = instRes.result?.items?.[0]
      const catalogProductId = String(inst?.['catalog_product_id'] ?? inst?.['catalogProductId'] ?? '')
      if (!catalogProductId) { setServiceTypes([]); setLoading(false); return }

      // 2. Get machine profile
      const profRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
        `/api/machine_catalog/machine-profiles?catalogProductId=${encodeURIComponent(catalogProductId)}&pageSize=1`,
        undefined,
        { fallback: { items: [] } },
      )
      const profile = profRes.result?.items?.[0]
      const profileId = String(profile?.['id'] ?? '')
      if (!profileId) { setServiceTypes([]); setLoading(false); return }

      // 3. Get service types for profile
      const stRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
        `/api/machine_catalog/service-types?machineProfileId=${encodeURIComponent(profileId)}&pageSize=50&sortField=sortOrder&sortDir=asc`,
        undefined,
        { fallback: { items: [] } },
      )
      const stItems = stRes.result?.items ?? []

      // 4. Enrich each service type with skills, certs, parts
      const details: ServiceTypeDetail[] = await Promise.all(
        stItems.map(async (st) => {
          const stId = String(st['id'])
          const [skillsRes, certsRes, partsRes] = await Promise.all([
            apiCall<{ items: Array<Record<string, unknown>> }>(
              `/api/machine_catalog/service-type-skills?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            ),
            apiCall<{ items: Array<Record<string, unknown>> }>(
              `/api/machine_catalog/service-type-certifications?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            ),
            apiCall<{ items: Array<Record<string, unknown>> }>(
              `/api/machine_catalog/service-type-parts?machineServiceTypeId=${encodeURIComponent(stId)}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            ),
          ])

          // Resolve part labels
          const rawParts = (partsRes.result?.items ?? []).map((p: Record<string, unknown>) => ({
            catalogProductId: String(p['catalog_product_id'] ?? p['catalogProductId'] ?? ''),
            productLabel: null as string | null,
            quantity: Number(p['quantity'] ?? 0),
          }))
          const productIds = rawParts.map((p) => p.catalogProductId).filter(Boolean)
          if (productIds.length > 0) {
            const prodRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
              `/api/catalog/products?id=${encodeURIComponent(productIds.join(','))}&pageSize=100`,
              undefined,
              { fallback: { items: [] } },
            )
            const labelMap = new Map<string, string>()
            for (const p of (prodRes.result?.items ?? [])) {
              const pid = String(p['id'])
              const title = String(p['title'] ?? '')
              const sku = String(p['sku'] ?? '')
              labelMap.set(pid, sku ? `${title} (${sku})` : title)
            }
            for (const part of rawParts) {
              part.productLabel = labelMap.get(part.catalogProductId) ?? null
            }
          }

          return {
            id: stId,
            serviceType: String(st['service_type'] ?? st['serviceType'] ?? ''),
            defaultTeamSize: toNum(st['default_team_size'] ?? st['defaultTeamSize']),
            defaultServiceDurationMinutes: toNum(st['default_service_duration_minutes'] ?? st['defaultServiceDurationMinutes']),
            startupNotes: toStr(st['startup_notes'] ?? st['startupNotes']),
            serviceNotes: toStr(st['service_notes'] ?? st['serviceNotes']),
            skills: (skillsRes.result?.items ?? []).map((s: Record<string, unknown>) => String(s['skill_name'] ?? s['skillName'] ?? '')),
            certifications: (certsRes.result?.items ?? []).map((c: Record<string, unknown>) => String(c['certification_name'] ?? c['certificationName'] ?? '')),
            parts: rawParts,
          }
        }),
      )

      // 5. Load current assignments for this ticket
      const assignRes = await apiCall<{ items: Array<{ id: string; machineServiceTypeId: string }> }>(
        `/api/service_tickets/ticket-service-types?ticketId=${encodeURIComponent(ticketId)}`,
        undefined,
        { fallback: { items: [] } },
      )

      setServiceTypes(details)
      setAssignments(assignRes.result?.items ?? [])
    } catch (err) {
      console.error('ServiceTypeAssignments.load', err)
    } finally {
      setLoading(false)
    }
  }, [ticketId, machineInstanceId])

  React.useEffect(() => { void load() }, [load])

  const handleToggle = async (serviceTypeId: string, assignmentId: string | null) => {
    setTogglingId(serviceTypeId)
    try {
      if (assignmentId) {
        // Unassign
        await apiCall(`/api/service_tickets/ticket-service-types?id=${encodeURIComponent(assignmentId)}`, {
          method: 'DELETE',
        }, { fallback: null })
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      } else {
        // Assign
        const res = await apiCall<{ id: string }>(`/api/service_tickets/ticket-service-types`, {
          method: 'POST',
          body: JSON.stringify({ ticketId, machineServiceTypeId: serviceTypeId }),
        }, { fallback: null })
        if (res.result?.id) {
          setAssignments((prev) => [...prev, { id: res.result!.id, machineServiceTypeId: serviceTypeId }])
        }
      }
    } catch {
      flash(t('service_tickets.serviceTypes.error', 'Failed to update service type assignment.'), 'error')
    } finally {
      setTogglingId(null)
    }
  }

  if (!machineInstanceId) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">
          {t('service_tickets.serviceTypes.title', 'Service Types')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {assignments.length > 0
            ? t('service_tickets.serviceTypes.countAssigned', `${assignments.length} assigned`)
            : t('service_tickets.serviceTypes.noneAssigned', 'None assigned')}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      ) : serviceTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('service_tickets.serviceTypes.noServiceTypes', 'No service types configured for this machine.')}</p>
      ) : (
        <div className="space-y-2">
          {serviceTypes.map((st) => {
            const assignment = assignments.find((a) => a.machineServiceTypeId === st.id)
            return (
              <ServiceTypeAccordion
                key={st.id}
                detail={st}
                assigned={!!assignment}
                assignmentId={assignment?.id ?? null}
                onToggle={handleToggle}
                toggling={togglingId === st.id}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
