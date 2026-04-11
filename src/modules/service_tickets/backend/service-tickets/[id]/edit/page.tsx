"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { deleteCrud, fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../../../../lib/constants'
import type { ServiceTicketListItem } from '../../../../types'

type TicketFormValues = {
  id: string
  service_type: string
  status: string
  priority: string
  description: string
  visit_date: string
  visit_end_date: string
  address: string
  customer_entity_id: string
  machine_asset_id: string
  order_id: string
}

export default function EditServiceTicketPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TicketFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const baseFields = React.useMemo<CrudField[]>(() => [
    {
      id: 'service_type',
      label: t('service_tickets.form.fields.serviceType.label'),
      type: 'select',
      required: true,
      options: SERVICE_TYPE_VALUES.map((value) => ({ value, label: t(SERVICE_TYPE_I18N_KEYS[value]) })),
    },
    {
      id: 'status',
      label: t('service_tickets.form.fields.status.label'),
      type: 'select',
      required: true,
      options: STATUS_VALUES.map((value) => ({ value, label: t(STATUS_I18N_KEYS[value]) })),
    },
    {
      id: 'priority',
      label: t('service_tickets.form.fields.priority.label'),
      type: 'select',
      options: PRIORITY_VALUES.map((value) => ({ value, label: t(PRIORITY_I18N_KEYS[value]) })),
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
    { id: 'basicInfo', title: t('service_tickets.form.groups.basicInfo'), column: 1, fields: ['service_type', 'status', 'priority', 'description'] },
    { id: 'schedule', title: t('service_tickets.form.groups.schedule'), column: 1, fields: ['visit_date', 'visit_end_date', 'address'] },
    { id: 'links', title: t('service_tickets.form.groups.links'), column: 2, fields: ['customer_entity_id', 'machine_asset_id', 'order_id'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/service-tickets?flash=${encodeURIComponent(t('service_tickets.form.flash.saved'))}&type=success`,
    [t],
  )

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) return

      setLoading(true)
      setErr(null)

      try {
        const data = await fetchCrudList<ServiceTicketListItem>('service_tickets/tickets', { id: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error(t('service_tickets.form.error.notFound'))

        const nextInitial: TicketFormValues = {
          id: item.id,
          service_type: item.serviceType,
          status: item.status,
          priority: item.priority,
          description: item.description ?? '',
          visit_date: item.visitDate ? item.visitDate.slice(0, 16) : '',
          visit_end_date: item.visitEndDate ? item.visitEndDate.slice(0, 16) : '',
          address: item.address ?? '',
          customer_entity_id: item.customerEntityId ?? '',
          machine_asset_id: item.machineAssetId ?? '',
          order_id: item.orderId ?? '',
        }

        if (!cancelled) setInitial(nextInitial)
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : t('service_tickets.form.error.load')
          setErr(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [id, t])

  const fallbackInitialValues = React.useMemo<TicketFormValues>(() => ({
    id: id ?? '',
    service_type: 'regular',
    status: 'new',
    priority: 'normal',
    description: '',
    visit_date: '',
    visit_end_date: '',
    address: '',
    customer_entity_id: '',
    machine_asset_id: '',
    order_id: '',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <ErrorMessage label={err} />
        ) : (
          <CrudForm<TicketFormValues>
            title={t('service_tickets.form.edit.title')}
            backHref="/backend/service-tickets"
            fields={baseFields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('service_tickets.form.edit.submit')}
            cancelHref="/backend/service-tickets"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('service_tickets.form.loading')}
            onSubmit={async (values) => { await updateCrud('service_tickets/tickets', values) }}
            onDelete={async () => {
              if (!id) return

              try {
                await deleteCrud('service_tickets/tickets', String(id))
                pushWithFlash(router, '/backend/service-tickets', t('service_tickets.form.flash.deleted'), 'success')
              } catch (error) {
                const message =
                  error instanceof Error && error.message ? error.message : t('service_tickets.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
