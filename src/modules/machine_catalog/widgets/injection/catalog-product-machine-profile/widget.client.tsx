"use client"

import * as React from 'react'
import Link from 'next/link'
import type { InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type MachineProfile = {
  id: string
  machineFamily: string | null
  modelCode: string | null
  defaultTeamSize: number | null
  defaultServiceDurationMinutes: number | null
  preventiveMaintenanceIntervalDays: number | null
  defaultWarrantyMonths: number | null
  startupNotes: string | null
  serviceNotes: string | null
  isActive: boolean
}

type PartTemplate = {
  id: string
  partName: string
  templateType: string
  serviceContext: string | null
  kitName: string | null
  partCode: string | null
  quantityDefault: number | null
  quantityUnit: string | null
  sortOrder: number
}

type WidgetContext = {
  resourceId?: string
  record?: { id?: string; catalog_product_id?: string }
}

function mapProfile(item: Record<string, unknown>): MachineProfile {
  const str = (k: string) => typeof item[k] === 'string' ? item[k] as string : null
  const num = (k: string) => typeof item[k] === 'number' ? item[k] as number : null
  return {
    id: str('id') ?? '',
    machineFamily: str('machine_family'),
    modelCode: str('model_code'),
    defaultTeamSize: num('default_team_size'),
    defaultServiceDurationMinutes: num('default_service_duration_minutes'),
    preventiveMaintenanceIntervalDays: num('preventive_maintenance_interval_days'),
    defaultWarrantyMonths: num('default_warranty_months'),
    startupNotes: str('startup_notes'),
    serviceNotes: str('service_notes'),
    isActive: item['is_active'] === true,
  }
}

function mapPartTemplate(item: Record<string, unknown>): PartTemplate {
  const str = (k: string) => typeof item[k] === 'string' ? item[k] as string : null
  const num = (k: string) => typeof item[k] === 'number' ? item[k] as number : null
  return {
    id: str('id') ?? '',
    partName: str('part_name') ?? '',
    templateType: str('template_type') ?? '',
    serviceContext: str('service_context'),
    kitName: str('kit_name'),
    partCode: str('part_code'),
    quantityDefault: num('quantity_default'),
    quantityUnit: str('quantity_unit'),
    sortOrder: num('sort_order') ?? 0,
  }
}

export default function MachineCatalogProfileWidget({ context: rawContext }: InjectionWidgetComponentProps) {
  const context = rawContext as WidgetContext | undefined
  const t = useT()
  const catalogProductId = context?.resourceId ?? context?.record?.id ?? null

  const [profile, setProfile] = React.useState<MachineProfile | null>(null)
  const [parts, setParts] = React.useState<PartTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!catalogProductId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ catalogProductId, pageSize: '1' })
      const profileCall = await apiCall<{ items?: Record<string, unknown>[] }>(
        `/api/machine_catalog/machine-profiles?${params.toString()}`,
        undefined,
        { fallback: { items: [] } },
      )
      const profileItem = profileCall.result?.items?.[0]
      if (!profileItem) { setProfile(null); setParts([]); setLoading(false); return }
      const prof = mapProfile(profileItem)
      setProfile(prof)

      const partsParams = new URLSearchParams({ machineProfileId: prof.id, pageSize: '50', sortField: 'sortOrder', sortDir: 'asc' })
      const partsCall = await apiCall<{ items?: Record<string, unknown>[] }>(
        `/api/machine_catalog/part-templates?${partsParams.toString()}`,
        undefined,
        { fallback: { items: [] } },
      )
      setParts((partsCall.result?.items ?? []).map(mapPartTemplate))
    } catch (err) {
      console.error('machine_catalog.widget.load', err)
      setError(t('machine_catalog.widget.error', 'Failed to load machine profile.'))
    } finally {
      setLoading(false)
    }
  }, [catalogProductId, t])

  React.useEffect(() => { void load() }, [load])

  if (!catalogProductId) return null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {t('machine_catalog.widget.title', 'Machine Profile')}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('machine_catalog.widget.subtitle', 'Service configuration and part templates for this machine.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? t('common.loading', 'Loading…') : t('common.refresh', 'Refresh')}
          </Button>
          {profile ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/backend/machine-catalog/${encodeURIComponent(profile.id)}`}>
                {t('machine_catalog.widget.edit', 'Edit profile')}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href={`/backend/machine-catalog/create`}>
                {t('machine_catalog.widget.create', 'Add profile')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : !profile ? (
        <p className="text-xs text-muted-foreground">{t('machine_catalog.widget.noProfile', 'No machine profile configured for this product.')}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {profile.machineFamily && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.machineFamily', 'Machine Family')}</span>
                <span className="font-medium">{profile.machineFamily}</span>
              </>
            )}
            {profile.modelCode && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.modelCode', 'Model Code')}</span>
                <span className="font-mono font-medium">{profile.modelCode}</span>
              </>
            )}
            {profile.defaultTeamSize != null && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.defaultTeamSize', 'Default Team Size')}</span>
                <span>{profile.defaultTeamSize}</span>
              </>
            )}
            {profile.defaultServiceDurationMinutes != null && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.defaultServiceDurationMinutes', 'Service Duration (min)')}</span>
                <span>{profile.defaultServiceDurationMinutes}</span>
              </>
            )}
            {profile.preventiveMaintenanceIntervalDays != null && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.preventiveMaintenanceIntervalDays', 'PM Interval (days)')}</span>
                <span>{profile.preventiveMaintenanceIntervalDays}</span>
              </>
            )}
            {profile.defaultWarrantyMonths != null && (
              <>
                <span className="text-muted-foreground">{t('machine_catalog.form.fields.defaultWarrantyMonths', 'Default Warranty (months)')}</span>
                <span>{profile.defaultWarrantyMonths}</span>
              </>
            )}
          </div>

          {parts.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-foreground mb-1">
                {t('machine_catalog.widget.partTemplates', 'Part Templates')} ({parts.length})
              </div>
              <ul className="space-y-1">
                {parts.map((part) => (
                  <li key={part.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {part.templateType}
                    </span>
                    <span className="flex-1 font-medium truncate">{part.partName}</span>
                    {part.partCode && <span className="font-mono text-muted-foreground">{part.partCode}</span>}
                    {part.quantityDefault != null && (
                      <span className="text-muted-foreground">{part.quantityDefault}{part.quantityUnit ? ` ${part.quantityUnit}` : ''}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.serviceNotes && (
            <div>
              <div className="text-xs font-semibold text-foreground mb-0.5">{t('machine_catalog.form.fields.serviceNotes', 'Service Notes')}</div>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{profile.serviceNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
