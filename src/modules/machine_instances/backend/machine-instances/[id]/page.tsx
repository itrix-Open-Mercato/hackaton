"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { searchCompanies } from '../../../components/companyOptions'
import { searchCatalogProducts } from '../../../components/catalogProductOptions'
import MachineServiceTypes from '../../../components/MachineServiceTypes'

type MachineFormValues = {
  id: string
  instanceCode: string
  serialNumber: string | null
  catalogProductId: string | null
  customerCompanyId: string | null
  siteName: string | null
  locationLabel: string | null
  contactName: string | null
  contactPhone: string | null
  manufacturedAt: string | null
  commissionedAt: string | null
  warrantyUntil: string | null
  warrantyStatus: string | null
  lastInspectionAt: string | null
  nextInspectionAt: string | null
  requiresAnnouncement: boolean
  announcementLeadTimeHours: number | null
  instanceNotes: string | null
  isActive: boolean
}

type MachineRecord = Record<string, unknown>

export default function EditMachineInstancePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<MachineFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'instanceCode', label: t('machine_instances.form.fields.instanceCode', 'Instance Code'), type: 'text', required: true },
    { id: 'serialNumber', label: t('machine_instances.form.fields.serialNumber', 'Serial Number'), type: 'text' },
    { id: 'catalogProductId', label: t('machine_instances.form.fields.catalogProductId', 'Catalog Product'), type: 'combobox', placeholder: 'Search products...', loadOptions: searchCatalogProducts, allowCustomValues: false },
    { id: 'customerCompanyId', label: t('machine_instances.form.fields.customerCompanyId', 'Customer Company'), type: 'combobox', placeholder: 'Search companies...', loadOptions: searchCompanies, allowCustomValues: false },
    { id: 'siteName', label: t('machine_instances.form.fields.siteName', 'Site Name'), type: 'text' },
    { id: 'locationLabel', label: t('machine_instances.form.fields.locationLabel', 'Location'), type: 'text' },
    { id: 'contactName', label: t('machine_instances.form.fields.contactName', 'Contact Name'), type: 'text' },
    { id: 'contactPhone', label: t('machine_instances.form.fields.contactPhone', 'Contact Phone'), type: 'text' },
    { id: 'manufacturedAt', label: t('machine_instances.form.fields.manufacturedAt', 'Manufacturing Date'), type: 'date' },
    { id: 'commissionedAt', label: t('machine_instances.form.fields.commissionedAt', 'Commissioning Date'), type: 'date' },
    { id: 'warrantyUntil', label: t('machine_instances.form.fields.warrantyUntil', 'Warranty Until'), type: 'date' },
    { id: 'warrantyStatus', label: t('machine_instances.form.fields.warrantyStatus', 'Warranty Status'), type: 'select', options: [
      { value: '', label: '—' },
      { value: 'active', label: t('machine_instances.warrantyStatus.active', 'Active') },
      { value: 'expired', label: t('machine_instances.warrantyStatus.expired', 'Expired') },
      { value: 'claim', label: t('machine_instances.warrantyStatus.claim', 'Claim') },
    ]},
    { id: 'lastInspectionAt', label: t('machine_instances.form.fields.lastInspectionAt', 'Last Inspection'), type: 'date' },
    { id: 'nextInspectionAt', label: t('machine_instances.form.fields.nextInspectionAt', 'Next Inspection'), type: 'date' },
    { id: 'requiresAnnouncement', label: t('machine_instances.form.fields.requiresAnnouncement', 'Requires Announcement'), type: 'checkbox' },
    { id: 'announcementLeadTimeHours', label: t('machine_instances.form.fields.announcementLeadTimeHours', 'Announcement Lead Time (h)'), type: 'number' },
    { id: 'instanceNotes', label: t('machine_instances.form.fields.instanceNotes', 'Notes'), type: 'textarea' },
    { id: 'isActive', label: t('machine_instances.form.fields.isActive', 'Active'), type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('machine_instances.form.groups.identity', 'Identity'), column: 1, fields: ['instanceCode', 'serialNumber', 'catalogProductId'] },
    { id: 'customer', title: t('machine_instances.form.groups.customer', 'Customer & Location'), column: 1, fields: ['customerCompanyId', 'siteName', 'locationLabel', 'contactName', 'contactPhone'] },
    { id: 'dates', title: t('machine_instances.form.groups.dates', 'Dates & Warranty'), column: 2, fields: ['manufacturedAt', 'commissionedAt', 'warrantyUntil', 'warrantyStatus'] },
    { id: 'inspection', title: t('machine_instances.form.groups.inspection', 'Inspection'), column: 2, fields: ['lastInspectionAt', 'nextInspectionAt'] },
    { id: 'access', title: t('machine_instances.form.groups.access', 'Access & Notes'), column: 1, fields: ['requiresAnnouncement', 'announcementLeadTimeHours', 'instanceNotes'] },
    { id: 'status', title: t('machine_instances.form.groups.status', 'Status'), column: 2, fields: ['isActive'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<MachineRecord>('machine_instances/machines', { ids: id, pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error('Machine instance not found.')
        const str = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'string' ? v as string : null
        }
        const bool = (camel: string, snake: string) => (item[camel] ?? item[snake]) === true
        const num = (camel: string, snake: string) => {
          const v = item[camel] ?? item[snake]
          return typeof v === 'number' ? v : null
        }
        const init: MachineFormValues = {
          id: String(item.id),
          instanceCode: str('instanceCode', 'instance_code') ?? '',
          serialNumber: str('serialNumber', 'serial_number'),
          catalogProductId: str('catalogProductId', 'catalog_product_id'),
          customerCompanyId: str('customerCompanyId', 'customer_company_id'),
          siteName: str('siteName', 'site_name'),
          locationLabel: str('locationLabel', 'location_label'),
          contactName: str('contactName', 'contact_name'),
          contactPhone: str('contactPhone', 'contact_phone'),
          manufacturedAt: str('manufacturedAt', 'manufactured_at'),
          commissionedAt: str('commissionedAt', 'commissioned_at'),
          warrantyUntil: str('warrantyUntil', 'warranty_until'),
          warrantyStatus: str('warrantyStatus', 'warranty_status'),
          lastInspectionAt: str('lastInspectionAt', 'last_inspection_at'),
          nextInspectionAt: str('nextInspectionAt', 'next_inspection_at'),
          requiresAnnouncement: bool('requiresAnnouncement', 'requires_announcement'),
          announcementLeadTimeHours: num('announcementLeadTimeHours', 'announcement_lead_time_hours'),
          instanceNotes: str('instanceNotes', 'instance_notes'),
          isActive: bool('isActive', 'is_active'),
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

  const fallback = React.useMemo<MachineFormValues>(() => ({
    id: id ?? '',
    instanceCode: '',
    serialNumber: null,
    catalogProductId: null,
    customerCompanyId: null,
    siteName: null,
    locationLabel: null,
    contactName: null,
    contactPhone: null,
    manufacturedAt: null,
    commissionedAt: null,
    warrantyUntil: null,
    warrantyStatus: null,
    lastInspectionAt: null,
    nextInspectionAt: null,
    requiresAnnouncement: false,
    announcementLeadTimeHours: null,
    instanceNotes: null,
    isActive: true,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600 p-4">{err}</div>
        ) : (
          <>
            <CrudForm<MachineFormValues>
              title={t('machine_instances.edit.title', 'Edit Machine Instance')}
              backHref="/backend/machine-instances"
              cancelHref="/backend/machine-instances"
              submitLabel={t('machine_instances.form.submit.save', 'Save')}
              fields={fields}
              groups={groups}
              initialValues={initial ?? fallback}
              isLoading={loading}
              loadingMessage={t('machine_instances.form.loading', 'Loading...')}
              successRedirect="/backend/machine-instances"
              onSubmit={async (vals) => { await updateCrud('machine_instances/machines', vals) }}
              onDelete={async () => {
                await deleteCrud('machine_instances/machines', String(id))
                pushWithFlash(router, '/backend/machine-instances', 'Machine instance deleted.', 'success')
              }}
            />
            {!loading && initial?.catalogProductId && (
              <MachineServiceTypes catalogProductId={initial.catalogProductId} />
            )}
          </>
        )}
      </PageBody>
    </Page>
  )
}
