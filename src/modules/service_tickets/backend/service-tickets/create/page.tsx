"use client"
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildTicketFields, buildTicketGroups, createEmptyTicketFormValues, type TicketFormValues } from '../../../components/ticketFormConfig'
import { ENTITY_TYPE } from '../../../lib/constants'
import { readAndConsumeInboxDraft, mergeInboxPrefill, markInboxActionExecuted, type InboxDraftData } from '../../../lib/inbox-prefill'

function InboxPrefillBanner({ draft }: { draft: InboxDraftData }) {
  const t = useT()
  return (
    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
      <strong>{t('service_tickets.inbox.prefillBanner', 'Pre-filled from email')}</strong>
      {' — '}
      <a
        href={`/backend/inbox-ops/proposals/${draft.proposalId}`}
        className="underline hover:text-blue-600"
      >
        {t('service_tickets.inbox.viewProposal', 'View proposal')}
      </a>
    </div>
  )
}

export default function CreateServiceTicketPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const fromInboxAction = searchParams.get('fromInboxAction')

  const [inboxDraft] = React.useState<InboxDraftData | null>(() => {
    if (!fromInboxAction) return null
    return readAndConsumeInboxDraft()
  })

  const initialValues = React.useMemo(() => {
    const defaults = createEmptyTicketFormValues()
    if (!inboxDraft?.payload) return defaults
    return mergeInboxPrefill(defaults, inboxDraft.payload)
  }, [inboxDraft])

  const fields = React.useMemo(() => buildTicketFields(t, { includeStatus: false }), [t])
  const groups = React.useMemo(() => buildTicketGroups(t, { includeStatus: false }), [t])

  const successRedirect = React.useMemo(
    () => `/backend/service-tickets?flash=${encodeURIComponent(t('service_tickets.form.flash.created'))}&type=success`,
    [t],
  )

  const handleSubmit = React.useCallback(async (values: TicketFormValues) => {
    const result = await createCrud('service_tickets/tickets', values)

    // Mark inbox action as executed if this was a prefill
    if (fromInboxAction && inboxDraft) {
      const ticketId = (result as any)?.id
      if (ticketId) {
        const ok = await markInboxActionExecuted(inboxDraft.proposalId, inboxDraft.actionId, ticketId)
        if (!ok) {
          flash(t('service_tickets.inbox.markFailed', 'Ticket saved, but could not update inbox action status.'), 'warning')
        }
      }
    }
  }, [fromInboxAction, inboxDraft, t])

  return (
    <Page>
      <PageBody>
        {inboxDraft && <InboxPrefillBanner draft={inboxDraft} />}
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
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
