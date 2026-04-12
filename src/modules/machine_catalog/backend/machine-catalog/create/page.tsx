"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateMachineProfilePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'catalogProductId', label: t('machine_catalog.form.fields.catalogProductId', 'Catalog Product ID'), type: 'text', required: true, placeholder: 'UUID of catalog product' },
    { id: 'machineFamily', label: t('machine_catalog.form.fields.machineFamily', 'Machine Family'), type: 'text', placeholder: 'e.g. CNC Fräsmaschinen' },
    { id: 'modelCode', label: t('machine_catalog.form.fields.modelCode', 'Model Code'), type: 'text', placeholder: 'e.g. VMC-500' },
    { id: 'preventiveMaintenanceIntervalDays', label: t('machine_catalog.form.fields.preventiveMaintenanceIntervalDays', 'PM Interval (days)'), type: 'number' },
    { id: 'defaultWarrantyMonths', label: t('machine_catalog.form.fields.defaultWarrantyMonths', 'Default Warranty (months)'), type: 'number' },
    { id: 'isActive', label: t('machine_catalog.form.fields.isActive', 'Active'), type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('machine_catalog.form.groups.identity', 'Identity'), column: 1, fields: ['catalogProductId', 'machineFamily', 'modelCode'] },
    { id: 'service', title: t('machine_catalog.form.groups.service', 'Service Defaults'), column: 2, fields: ['preventiveMaintenanceIntervalDays', 'defaultWarrantyMonths'] },
    { id: 'status', title: t('machine_catalog.form.groups.status', 'Status'), column: 2, fields: ['isActive'] },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('machine_catalog.create.title', 'New Machine Profile')}
          backHref="/backend/machine-catalog"
          cancelHref="/backend/machine-catalog"
          submitLabel={t('machine_catalog.form.submit.create', 'Create')}
          fields={fields}
          groups={groups}
          initialValues={{ isActive: true }}
          successRedirect="/backend/machine-catalog"
          onSubmit={async (vals) => { await createCrud('machine_catalog/machine-profiles', vals) }}
        />
      </PageBody>
    </Page>
  )
}
