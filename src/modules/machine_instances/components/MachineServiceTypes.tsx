"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
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
  parts: Array<{ label: string; quantity: number }>
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="text-muted-foreground shrink-0 min-w-[120px]">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  )
}

function ServiceTypeCard({ detail }: { detail: ServiceTypeDetail }) {
  const t = useT()
  const [expanded, setExpanded] = React.useState(false)

  const hasDetails = detail.defaultTeamSize != null
    || detail.defaultServiceDurationMinutes != null
    || detail.startupNotes != null
    || detail.serviceNotes != null
    || detail.skills.length > 0
    || detail.certifications.length > 0
    || detail.parts.length > 0

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {detail.serviceType}
          </span>
          {detail.defaultTeamSize != null && (
            <span className="text-xs text-muted-foreground">
              {t('machine_instances.serviceTypes.team', 'Team')}: {detail.defaultTeamSize}
            </span>
          )}
          {detail.defaultServiceDurationMinutes != null && (
            <span className="text-xs text-muted-foreground">
              {detail.defaultServiceDurationMinutes} min
            </span>
          )}
          {detail.skills.length > 0 && (
            <span className="text-xs text-muted-foreground">{detail.skills.length} skill(s)</span>
          )}
          {detail.certifications.length > 0 && (
            <span className="text-xs text-muted-foreground">{detail.certifications.length} cert(s)</span>
          )}
          {detail.parts.length > 0 && (
            <span className="text-xs text-muted-foreground">{detail.parts.length} part(s)</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {detail.defaultTeamSize != null && (
            <DetailRow label={t('machine_instances.serviceTypes.fields.teamSize', 'Team size')}>
              {detail.defaultTeamSize}
            </DetailRow>
          )}
          {detail.defaultServiceDurationMinutes != null && (
            <DetailRow label={t('machine_instances.serviceTypes.fields.duration', 'Duration')}>
              {detail.defaultServiceDurationMinutes} min
            </DetailRow>
          )}
          {detail.startupNotes && (
            <DetailRow label={t('machine_instances.serviceTypes.fields.startupNotes', 'Startup notes')}>
              {detail.startupNotes}
            </DetailRow>
          )}
          {detail.serviceNotes && (
            <DetailRow label={t('machine_instances.serviceTypes.fields.serviceNotes', 'Service notes')}>
              {detail.serviceNotes}
            </DetailRow>
          )}

          {detail.skills.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">
                {t('machine_instances.serviceTypes.fields.requiredSkills', 'Required skills')}
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {detail.skills.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail.certifications.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">
                {t('machine_instances.serviceTypes.fields.requiredCertifications', 'Required certifications')}
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {detail.certifications.map((c) => (
                  <span key={c} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail.parts.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">
                {t('machine_instances.serviceTypes.fields.requiredParts', 'Required parts')}
              </span>
              <div className="mt-1 space-y-0.5">
                {detail.parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground">x{p.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasDetails && (
            <p className="text-xs text-muted-foreground">
              {t('machine_instances.serviceTypes.noDetails', 'No additional details configured.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function MachineServiceTypes({ catalogProductId }: { catalogProductId: string | null }) {
  const t = useT()
  const [serviceTypes, setServiceTypes] = React.useState<ServiceTypeDetail[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!catalogProductId) {
        setServiceTypes([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // catalog product → machine profile → service types
        const profRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
          `/api/machine_catalog/machine-profiles?catalogProductId=${encodeURIComponent(catalogProductId)}&pageSize=1`,
          undefined,
          { fallback: { items: [] } },
        )
        const profileId = String(profRes.result?.items?.[0]?.['id'] ?? '')
        if (!profileId) { if (!cancelled) { setServiceTypes([]); setLoading(false) } return }

        const stRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
          `/api/machine_catalog/service-types?machineProfileId=${encodeURIComponent(profileId)}&pageSize=50&sortField=sortOrder&sortDir=asc`,
          undefined,
          { fallback: { items: [] } },
        )

        const enriched: ServiceTypeDetail[] = await Promise.all(
          (stRes.result?.items ?? []).map(async (st) => {
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
              label: '' as string,
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
                const title = String(p['title'] ?? '')
                const sku = String(p['sku'] ?? '')
                labelMap.set(String(p['id']), sku ? `${title} (${sku})` : title)
              }
              for (const part of rawParts) {
                part.label = labelMap.get(part.catalogProductId) ?? part.catalogProductId
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
              parts: rawParts.map((p) => ({ label: p.label, quantity: p.quantity })),
            }
          }),
        )

        if (!cancelled) setServiceTypes(enriched)
      } catch (err) {
        console.error('MachineServiceTypes.load', err)
        if (!cancelled) setServiceTypes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [catalogProductId])

  if (!catalogProductId) return null
  if (loading) return <p className="text-sm text-muted-foreground mt-6">{t('common.loading', 'Loading...')}</p>
  if (serviceTypes.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-foreground mb-4">
        {t('machine_instances.serviceTypes.title', 'Available Service Types')}
      </h2>
      <div className="space-y-2">
        {serviceTypes.map((st) => (
          <ServiceTypeCard key={st.id} detail={st} />
        ))}
      </div>
    </div>
  )
}
