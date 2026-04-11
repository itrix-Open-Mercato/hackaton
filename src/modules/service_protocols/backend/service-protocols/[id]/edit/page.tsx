"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ProtocolDetail = {
  id: string
  protocolNumber: string
  status: string
  workDescription: string | null
  technicianNotes: string | null
  customerNotes: string | null
}

export default function EditServiceProtocolPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id

  const [workDescription, setWorkDescription] = React.useState('')
  const [technicianNotes, setTechnicianNotes] = React.useState('')
  const [customerNotes, setCustomerNotes] = React.useState('')

  const { data: protocol, isLoading, error } = useQuery({
    queryKey: ['service_protocol_edit', id],
    queryFn: async () => {
      const result = await fetchCrudList<ProtocolDetail>('service_protocols/protocols', { id: String(id), pageSize: 1 })
      return result?.items?.[0] ?? null
    },
    enabled: !!id,
  })

  React.useEffect(() => {
    if (protocol) {
      setWorkDescription(protocol.workDescription ?? '')
      setTechnicianNotes(protocol.technicianNotes ?? '')
      setCustomerNotes(protocol.customerNotes ?? '')
    }
  }, [protocol])

  const saveMutation = useMutation({
    mutationFn: () => updateCrud('service_protocols/protocols', {
      id,
      work_description: workDescription || null,
      technician_notes: technicianNotes || null,
      customer_notes: customerNotes || null,
    }),
    onSuccess: () => {
      flash(t('service_protocols.form.flash.saved'), 'success')
      router.push(`/backend/service-protocols/${id}`)
    },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.form.error.save'), 'error'),
  })

  if (!id) return null
  if (isLoading) return <Page><PageBody><LoadingMessage /></PageBody></Page>
  if (error || !protocol) return <Page><PageBody><ErrorMessage label={t('service_protocols.form.error.load')} /></PageBody></Page>

  if (protocol.status === 'closed' || protocol.status === 'cancelled') {
    return (
      <Page>
        <PageBody>
          <div className="max-w-2xl mx-auto p-6">
            <p className="text-sm text-muted-foreground">{t('service_protocols.form.error.readonly')}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push(`/backend/service-protocols/${id}`)}>
              {t('service_protocols.detail.back')}
            </Button>
          </div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{t('service_protocols.form.edit.title')} — {protocol.protocolNumber}</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('service_protocols.field.workDescription')}</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={4}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('service_protocols.field.technicianNotes')}</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('service_protocols.field.customerNotes')}</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {t('service_protocols.form.edit.submit')}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/backend/service-protocols/${id}`)}>
              {t('service_protocols.form.cancel')}
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
