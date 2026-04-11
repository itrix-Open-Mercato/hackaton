"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildTicketFields, buildTicketGroups, createEmptyTicketFormValues, type TicketFormValues } from '../../../components/ticketFormConfig'
import { ENTITY_TYPE } from '../../../lib/constants'

export default function CreateServiceTicketPage() {
  const t = useT()

  const fields = React.useMemo(() => buildTicketFields(t, { includeStatus: false }), [t])
  const groups = React.useMemo(() => buildTicketGroups(t, { includeStatus: false }), [t])

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
          initialValues={createEmptyTicketFormValues()}
          submitLabel={t('service_tickets.form.create.submit')}
          cancelHref="/backend/service-tickets"
          successRedirect={successRedirect}
          onSubmit={async (values) => { await createCrud('service_tickets/tickets', values) }}
        />
      </PageBody>
    </Page>
  )
}
