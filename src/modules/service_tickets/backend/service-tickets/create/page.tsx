"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
} from '../../../lib/constants'

export default function CreateServiceTicketPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'service_type',
      label: t('service_tickets.form.fields.serviceType.label'),
      type: 'select',
      required: true,
      options: SERVICE_TYPE_VALUES.map((value) => ({ value, label: t(SERVICE_TYPE_I18N_KEYS[value]) })),
    },
    {
      id: 'priority',
      label: t('service_tickets.form.fields.priority.label'),
      type: 'select',
      options: PRIORITY_VALUES.map((value) => ({ value, label: t(PRIORITY_I18N_KEYS[value]) })),
      defaultValue: 'normal',
    },
    {
      id: 'description',
      label: t('service_tickets.form.fields.description.label'),
      type: 'textarea',
      placeholder: t('service_tickets.form.fields.description.placeholder'),
    },
    {
      id: 'visit_date',
      label: t('service_tickets.form.fields.visitDate.label'),
      type: 'datetime-local',
    },
    {
      id: 'visit_end_date',
      label: t('service_tickets.form.fields.visitEndDate.label'),
      type: 'datetime-local',
    },
    {
      id: 'address',
      label: t('service_tickets.form.fields.address.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.address.placeholder'),
    },
    {
      id: 'customer_entity_id',
      label: t('service_tickets.form.fields.customerEntityId.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.customerEntityId.placeholder'),
    },
    {
      id: 'machine_asset_id',
      label: t('service_tickets.form.fields.machineAssetId.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.machineAssetId.placeholder'),
    },
    {
      id: 'order_id',
      label: t('service_tickets.form.fields.orderId.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.orderId.placeholder'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basicInfo', title: t('service_tickets.form.groups.basicInfo'), column: 1, fields: ['service_type', 'priority', 'description'] },
    { id: 'schedule', title: t('service_tickets.form.groups.schedule'), column: 1, fields: ['visit_date', 'visit_end_date', 'address'] },
    { id: 'links', title: t('service_tickets.form.groups.links'), column: 2, fields: ['customer_entity_id', 'machine_asset_id', 'order_id'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/service-tickets?flash=${encodeURIComponent(t('service_tickets.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('service_tickets.form.create.title')}
          backHref="/backend/service-tickets"
          fields={fields}
          groups={groups}
          submitLabel={t('service_tickets.form.create.submit')}
          cancelHref="/backend/service-tickets"
          successRedirect={successRedirect}
          onSubmit={async (values) => { await createCrud('service_tickets/tickets', values) }}
        />
      </PageBody>
    </Page>
  )
}
