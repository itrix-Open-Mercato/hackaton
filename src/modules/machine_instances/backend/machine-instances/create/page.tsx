"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateMachineInstancePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'instanceCode', label: t('machine_instances.form.fields.instanceCode', 'Instance Code'), type: 'text', required: true, placeholder: 'RES-00001' },
    { id: 'serialNumber', label: t('machine_instances.form.fields.serialNumber', 'Serial Number'), type: 'text', placeholder: 'SN-2024-001' },
    { id: 'catalogProductId', label: t('machine_instances.form.fields.catalogProductId', 'Catalog Product ID'), type: 'text', placeholder: 'UUID of catalog product' },
    { id: 'customerCompanyId', label: t('machine_instances.form.fields.customerCompanyId', 'Customer Company ID'), type: 'text', placeholder: 'UUID of customer company' },
    { id: 'siteName', label: t('machine_instances.form.fields.siteName', 'Site Name'), type: 'text', placeholder: 'e.g. Fabryka Części Sp. z o.o.' },
    { id: 'locationLabel', label: t('machine_instances.form.fields.locationLabel', 'Location'), type: 'text', placeholder: 'e.g. Hala B, stanowisko 4' },
    { id: 'contactName', label: t('machine_instances.form.fields.contactName', 'Contact Name'), type: 'text' },
    { id: 'contactPhone', label: t('machine_instances.form.fields.contactPhone', 'Contact Phone'), type: 'text' },
    { id: 'manufacturedAt', label: t('machine_instances.form.fields.manufacturedAt', 'Manufacturing Date'), type: 'date' },
    { id: 'commissionedAt', label: t('machine_instances.form.fields.commissionedAt', 'Commissioning Date'), type: 'date' },
    { id: 'warrantyUntil', label: t('machine_instances.form.fields.warrantyUntil', 'Warranty Until'), type: 'date' },
    { id: 'warrantyStatus', label: t('machine_instances.form.fields.warrantyStatus', 'Warranty Status'), type: 'select', options: [
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

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('machine_instances.create.title', 'New Machine Instance')}
          backHref="/backend/machine-instances"
          cancelHref="/backend/machine-instances"
          submitLabel={t('machine_instances.form.submit.create', 'Create')}
          fields={fields}
          groups={groups}
          initialValues={{ isActive: true, requiresAnnouncement: false }}
          successRedirect="/backend/machine-instances"
          onSubmit={async (vals) => { await createCrud('machine_instances/machines', vals) }}
        />
      </PageBody>
    </Page>
  )
}
