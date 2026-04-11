"use client"
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildTicketFields, buildTicketGroups, createEmptyTicketFormValues, type TicketFormValues } from '../../../components/ticketFormConfig'
import { ENTITY_TYPE } from '../../../lib/constants'

export default function CreateServiceTicketPage() {
  const t = useT()
  const searchParams = useSearchParams()

  const fields = React.useMemo(() => buildTicketFields(t, { includeStatus: false }), [t])
  const groups = React.useMemo(() => buildTicketGroups(t, { includeStatus: false }), [t])
  const phoneCallId = searchParams?.get('phone_call_id') ?? ''
  const initialValues = React.useMemo<TicketFormValues>(() => {
    const values = createEmptyTicketFormValues()
    if (!searchParams) return values
    const setString = (key: keyof TicketFormValues) => {
      const value = searchParams.get(key)
      if (value != null) values[key] = value
    }
    setString('service_type')
    setString('priority')
    setString('description')
    setString('visit_date')
    setString('address')
    setString('customer_entity_id')
    setString('contact_person_id')
    setString('machine_asset_id')
    setString('order_id')
    return values
  }, [searchParams])

  const successRedirect = React.useMemo(
    () => `/backend/service-tickets?flash=${encodeURIComponent(t('service_tickets.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<TicketFormValues>
          title={t('service_tickets.form.create.title')}
          backHref="/backend/service-tickets"
          entityIds={[ENTITY_TYPE]}
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('service_tickets.form.create.submit')}
          cancelHref="/backend/service-tickets"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            const response = await createCrud<{ id?: string }>('service_tickets/tickets', values)
            const ticketId = response.result?.id
            if (phoneCallId && ticketId) {
              await apiCallOrThrow(`/api/phone_calls/calls/${phoneCallId}/link-service-ticket`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ service_ticket_id: ticketId, source_action: 'create_from_call' }),
              })
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
