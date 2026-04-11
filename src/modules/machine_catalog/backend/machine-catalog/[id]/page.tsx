"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ProfileFormValues = {
  id: string
  catalogProductId: string | null
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

type ProfileRecord = Record<string, unknown>

export default function EditMachineProfilePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<ProfileFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'catalogProductId', label: t('machine_catalog.form.fields.catalogProductId', 'Catalog Product ID'), type: 'text' },
    { id: 'machineFamily', label: t('machine_catalog.form.fields.machineFamily', 'Machine Family'), type: 'text' },
    { id: 'modelCode', label: t('machine_catalog.form.fields.modelCode', 'Model Code'), type: 'text' },
    { id: 'defaultTeamSize', label: t('machine_catalog.form.fields.defaultTeamSize', 'Default Team Size'), type: 'number' },
    { id: 'defaultServiceDurationMinutes', label: t('machine_catalog.form.fields.defaultServiceDurationMinutes', 'Default Service Duration (min)'), type: 'number' },
    { id: 'preventiveMaintenanceIntervalDays', label: t('machine_catalog.form.fields.preventiveMaintenanceIntervalDays', 'PM Interval (days)'), type: 'number' },
    { id: 'defaultWarrantyMonths', label: t('machine_catalog.form.fields.defaultWarrantyMonths', 'Default Warranty (months)'), type: 'number' },
    { id: 'startupNotes', label: t('machine_catalog.form.fields.startupNotes', 'Startup Notes'), type: 'textarea' },
    { id: 'serviceNotes', label: t('machine_catalog.form.fields.serviceNotes', 'Service Notes'), type: 'textarea' },
    { id: 'isActive', label: t('machine_catalog.form.fields.isActive', 'Active'), type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('machine_catalog.form.groups.identity', 'Identity'), column: 1, fields: ['catalogProductId', 'machineFamily', 'modelCode'] },
    { id: 'service', title: t('machine_catalog.form.groups.service', 'Service Defaults'), column: 2, fields: ['defaultTeamSize', 'defaultServiceDurationMinutes', 'preventiveMaintenanceIntervalDays', 'defaultWarrantyMonths'] },
    { id: 'notes', title: t('machine_catalog.form.groups.notes', 'Notes'), column: 1, fields: ['startupNotes', 'serviceNotes'] },
    { id: 'status', title: t('machine_catalog.form.groups.status', 'Status'), column: 2, fields: ['isActive'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<ProfileRecord>('machine_catalog/machine-profiles', { ids: id, pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error('Machine profile not found.')
        const str = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'string' ? v as string : null
        }
        const num = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'number' ? v as number : null
        }
        const init: ProfileFormValues = {
          id: String(item.id),
          catalogProductId: str('catalogProductId', 'catalog_product_id'),
          machineFamily: str('machineFamily', 'machine_family'),
          modelCode: str('modelCode', 'model_code'),
          defaultTeamSize: num('defaultTeamSize', 'default_team_size'),
          defaultServiceDurationMinutes: num('defaultServiceDurationMinutes', 'default_service_duration_minutes'),
          preventiveMaintenanceIntervalDays: num('preventiveMaintenanceIntervalDays', 'preventive_maintenance_interval_days'),
          defaultWarrantyMonths: num('defaultWarrantyMonths', 'default_warranty_months'),
          startupNotes: str('startupNotes', 'startup_notes'),
          serviceNotes: str('serviceNotes', 'service_notes'),
          isActive: (item.isActive ?? item.is_active) === true,
        }
        if (!cancelled) setInitial(init)
      } catch (error) {
        if (!cancelled) setErr(error instanceof Error ? error.message : 'Failed to load.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const fallback = React.useMemo<ProfileFormValues>(() => ({
    id: id ?? '',
    catalogProductId: null,
    machineFamily: null,
    modelCode: null,
    defaultTeamSize: null,
    defaultServiceDurationMinutes: null,
    preventiveMaintenanceIntervalDays: null,
    defaultWarrantyMonths: null,
    startupNotes: null,
    serviceNotes: null,
    isActive: true,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600 p-4">{err}</div>
        ) : (
          <CrudForm<ProfileFormValues>
            title={t('machine_catalog.edit.title', 'Edit Machine Profile')}
            backHref="/backend/machine-catalog"
            cancelHref="/backend/machine-catalog"
            submitLabel={t('machine_catalog.form.submit.save', 'Save')}
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            isLoading={loading}
            loadingMessage={t('machine_catalog.form.loading', 'Loading...')}
            successRedirect="/backend/machine-catalog"
            onSubmit={async (vals) => { await updateCrud('machine_catalog/machine-profiles', vals) }}
            onDelete={async () => {
              await deleteCrud('machine_catalog/machine-profiles', String(id))
              pushWithFlash(router, '/backend/machine-catalog', 'Machine profile deleted.', 'success')
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
