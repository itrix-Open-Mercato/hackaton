"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { deleteCrud, fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  buildTicketFields,
  buildTicketGroups,
  createEmptyTicketFormValues,
  geocodeAddress,
  mapTicketToFormValues,
  type TicketFormValues,
} from '../../../../components/ticketFormConfig'
import { ENTITY_TYPE } from '../../../../lib/constants'
import type { ServiceTicketListItem } from '../../../../types'

export default function EditServiceTicketPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TicketFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const baseFields = React.useMemo(() => buildTicketFields(t, { includeStatus: true }), [t])
  const groups = React.useMemo(() => buildTicketGroups(t, { includeStatus: true }), [t])

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

        const nextInitial = mapTicketToFormValues(item)

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

  // Auto-geocode: when ticket loads with address but no coordinates, fill them in the background
  React.useEffect(() => {
    if (!initial) return
    const address = initial.address?.trim()
    const hasCoords = initial.latitude?.trim() && initial.longitude?.trim()
    if (!address || hasCoords) return

    let cancelled = false
    void geocodeAddress(address).then((coords) => {
      if (cancelled || !coords) return
      setInitial((prev) => prev ? { ...prev, latitude: String(coords.lat), longitude: String(coords.lng) } : prev)
    })
    return () => { cancelled = true }
  }, [initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- run once after initial load, keyed by ticket id

  const fallbackInitialValues = React.useMemo<TicketFormValues>(() => createEmptyTicketFormValues(id ?? ''), [id])

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
              entityIds={[ENTITY_TYPE]}
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
