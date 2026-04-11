"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ServiceTypeOption = {
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

export default function ServiceTypePicker({
  machineInstanceId,
  selectedIds,
  onChange,
}: {
  machineInstanceId: string | null
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const t = useT()
  const [options, setOptions] = React.useState<ServiceTypeOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!machineInstanceId) {
        setOptions([])
        return
      }

      setLoading(true)
      try {
        // machine instance → catalog product → profile → service types
        const instRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
          `/api/machine_instances/machines?ids=${encodeURIComponent(machineInstanceId)}&pageSize=1`,
          undefined,
          { fallback: { items: [] } },
        )
        const catalogProductId = String(instRes.result?.items?.[0]?.['catalog_product_id'] ?? instRes.result?.items?.[0]?.['catalogProductId'] ?? '')
        if (!catalogProductId) { if (!cancelled) setOptions([]); return }

        const profRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
          `/api/machine_catalog/machine-profiles?catalogProductId=${encodeURIComponent(catalogProductId)}&pageSize=1`,
          undefined,
          { fallback: { items: [] } },
        )
        const profileId = String(profRes.result?.items?.[0]?.['id'] ?? '')
        if (!profileId) { if (!cancelled) setOptions([]); return }

        const stRes = await apiCall<{ items: Array<Record<string, unknown>> }>(
          `/api/machine_catalog/service-types?machineProfileId=${encodeURIComponent(profileId)}&pageSize=50&sortField=sortOrder&sortDir=asc`,
          undefined,
          { fallback: { items: [] } },
        )

        const enriched: ServiceTypeOption[] = await Promise.all(
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

        if (!cancelled) setOptions(enriched)
      } catch (err) {
        console.error('ServiceTypePicker.load', err)
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [machineInstanceId])

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((v) => v !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  if (!machineInstanceId) return null
  if (loading) return <p className="text-xs text-muted-foreground py-2">{t('common.loading', 'Loading...')}</p>
  if (options.length === 0) return null

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {t('service_tickets.serviceTypes.pickerLabel', 'Service types to be conducted')}
      </label>
      {options.map((opt) => {
        const checked = selectedIds.includes(opt.id)
        const expanded = expandedId === opt.id
        return (
          <div key={opt.id} className={`rounded-lg border ${checked ? 'border-primary/40 bg-primary/5' : 'bg-card'}`}>
            <div className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.id)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <button
                type="button"
                className="flex-1 flex items-center gap-2 text-left text-xs"
                onClick={() => setExpandedId(expanded ? null : opt.id)}
              >
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {opt.serviceType}
                </span>
                {opt.defaultTeamSize != null && <span className="text-muted-foreground">Team: {opt.defaultTeamSize}</span>}
                {opt.defaultServiceDurationMinutes != null && <span className="text-muted-foreground">{opt.defaultServiceDurationMinutes} min</span>}
                {opt.skills.length > 0 && <span className="text-muted-foreground">{opt.skills.length} skill(s)</span>}
                <span className="text-muted-foreground ml-auto">{expanded ? '▲' : '▼'}</span>
              </button>
            </div>

            {expanded && (
              <div className="border-t px-3 py-2 space-y-2 text-xs">
                {opt.defaultTeamSize != null && (
                  <div><span className="text-muted-foreground">Team size:</span> <span className="font-medium">{opt.defaultTeamSize}</span></div>
                )}
                {opt.defaultServiceDurationMinutes != null && (
                  <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{opt.defaultServiceDurationMinutes} min</span></div>
                )}
                {opt.startupNotes && (
                  <div><span className="text-muted-foreground">Startup notes:</span> <span className="font-medium">{opt.startupNotes}</span></div>
                )}
                {opt.serviceNotes && (
                  <div><span className="text-muted-foreground">Service notes:</span> <span className="font-medium">{opt.serviceNotes}</span></div>
                )}
                {opt.skills.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Required skills: </span>
                    {opt.skills.map((s) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 mr-1">{s}</span>
                    ))}
                  </div>
                )}
                {opt.certifications.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Required certifications: </span>
                    {opt.certifications.map((c) => (
                      <span key={c} className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 mr-1">{c}</span>
                    ))}
                  </div>
                )}
                {opt.parts.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Required parts: </span>
                    {opt.parts.map((p, i) => (
                      <span key={i} className="text-foreground">{p.label} x{p.quantity}{i < opt.parts.length - 1 ? ', ' : ''}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
