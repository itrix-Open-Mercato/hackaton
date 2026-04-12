"use client"
import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ClipboardList } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@open-mercato/ui/primitives/dialog'
import type { InjectionWidgetModule, InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'

type ProtocolListItem = {
  id: string
  protocolNumber: string
  status: string
}

type ProtocolDetail = {
  id: string
  protocolNumber: string
  status: string
  workDescription: string | null
  technicianNotes: string | null
  customerNotes: string | null
}

type ProtocolsResponse = {
  items: ProtocolListItem[]
  totalCount?: number
}

const NON_ACTIONABLE_TICKET_STATUSES = ['new', 'cancelled']

const DIALOG_STORAGE_PREFIX = 'om:service_protocol_dialog:'

function readStoredProtocolId(ticketId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DIALOG_STORAGE_PREFIX + ticketId)
    return raw && raw.trim().length > 0 ? raw.trim() : null
  } catch {
    return null
  }
}

function persistProtocolDialogId(ticketId: string, protocolId: string | null) {
  if (typeof window === 'undefined') return
  try {
    const key = DIALOG_STORAGE_PREFIX + ticketId
    if (protocolId) sessionStorage.setItem(key, protocolId)
    else sessionStorage.removeItem(key)
  } catch {
    /* ignore quota / private mode */
  }
}

function openProtocolDialog(ticketId: string | undefined, protocolId: string, setDialogProtocolId: (protocolId: string) => void) {
  if (ticketId) persistProtocolDialogId(ticketId, protocolId)
  setDialogProtocolId(protocolId)
}

function ServiceTicketProtocolActionWidget({ data }: InjectionWidgetComponentProps) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { runMutation } = useGuardedMutation<Record<string, unknown>>({
    contextId: 'service_protocols.injection.ServiceTicketProtocolAction',
  })

  const [dialogProtocolId, setDialogProtocolId] = React.useState<string | null>(null)
  const [workDescription, setWorkDescription] = React.useState('')
  const [technicianNotes, setTechnicianNotes] = React.useState('')
  const [customerNotes, setCustomerNotes] = React.useState('')

  const formValues = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

  const ticketId = (formValues.id ?? formValues.ticketId) as string | undefined
  const ticketStatus = (formValues.status ?? formValues.ticketStatus) as string | undefined
  const staffMemberIds = (formValues.staff_member_ids ?? formValues.staffMemberIds) as string[] | undefined

  const statusAllowed = ticketStatus && !NON_ACTIONABLE_TICKET_STATUSES.includes(ticketStatus)
  const hasTechnicians = Array.isArray(staffMemberIds) && staffMemberIds.length > 0
  const canCreateProtocol = !!ticketId && statusAllowed && hasTechnicians

  const { data: protocolData, isLoading: checkingProtocol } = useQuery<ProtocolsResponse>({
    queryKey: ['service_ticket_protocol_check', ticketId, scopeVersion],
    queryFn: () => fetchCrudList<ProtocolListItem>('service_protocols/protocols', {
      serviceTicketId: ticketId!,
      pageSize: 1,
    }),
    enabled: !!ticketId,
  })

  const activeProtocol = React.useMemo(() => {
    return protocolData?.items?.find((p) => p.status !== 'cancelled') ?? null
  }, [protocolData])

  // Restore dialog after InjectionSpot remounts (registry reload returns null briefly) or full widget remount
  React.useLayoutEffect(() => {
    if (!ticketId) return
    const stored = readStoredProtocolId(ticketId)
    if (stored) setDialogProtocolId(stored)
  }, [ticketId])

  React.useEffect(() => {
    if (!ticketId || !dialogProtocolId) return
    persistProtocolDialogId(ticketId, dialogProtocolId)
  }, [ticketId, dialogProtocolId])

  // Load protocol detail when dialog opens
  const { data: protocolDetail, isLoading: loadingDetail } = useQuery<ProtocolDetail | null>({
    queryKey: ['service_protocol_dialog', dialogProtocolId],
    queryFn: async () => {
      const result = await fetchCrudList<ProtocolDetail>('service_protocols/protocols', {
        id: dialogProtocolId!,
        pageSize: 1,
      })
      return result?.items?.[0] ?? null
    },
    enabled: !!dialogProtocolId,
  })

  // Populate form fields when protocol detail loads
  React.useEffect(() => {
    if (protocolDetail) {
      setWorkDescription(protocolDetail.workDescription ?? '')
      setTechnicianNotes(protocolDetail.technicianNotes ?? '')
      setCustomerNotes(protocolDetail.customerNotes ?? '')
    }
  }, [protocolDetail])

  // Reset form fields when dialog closes
  const closeDialog = React.useCallback(() => {
    if (ticketId) persistProtocolDialogId(ticketId, null)
    setDialogProtocolId(null)
    setWorkDescription('')
    setTechnicianNotes('')
    setCustomerNotes('')
  }, [ticketId])

  const createMutation = useMutation({
    mutationFn: async () => {
      return runMutation({
        context: {
          entityId: 'service_protocols.protocol',
          recordId: ticketId ?? null,
          operation: 'create',
        },
        mutationPayload: { service_ticket_id: ticketId },
        operation: () => readApiResultOrThrow<{ id: string; protocolNumber: string; status: string; serviceTicketId: string }>('/api/service_protocols/protocols', {
          method: 'POST',
          body: JSON.stringify({ service_ticket_id: ticketId }),
        }),
      })
    },
    onSuccess: (result) => {
      openProtocolDialog(ticketId, result.id, setDialogProtocolId)
    },
    onError: (err) => {
      flash(err instanceof Error ? err.message : t('service_protocols.widget.error'), 'error')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => updateCrud('service_protocols/protocols', {
      id: dialogProtocolId,
      work_description: workDescription || null,
      technician_notes: technicianNotes || null,
      customer_notes: customerNotes || null,
    }),
    onSuccess: () => {
      flash(t('service_protocols.form.flash.saved'), 'success')
      closeDialog()
    },
    onError: (err) => {
      flash(err instanceof Error ? err.message : t('service_protocols.form.error.save'), 'error')
    },
  })

  if (!ticketId) return null

  const dialogReadonly = protocolDetail?.status === 'closed' || protocolDetail?.status === 'cancelled'

  return (
    <>
      {/* Compact toolbar: lives in CrudForm header (outside <form>), next to Save/Cancel */}
      <div className="flex max-w-xl flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs sm:text-sm">
        <span className="flex shrink-0 items-center gap-1 font-medium text-foreground">
          <ClipboardList size={14} className="text-muted-foreground" aria-hidden />
          {t('service_protocols.widget.title')}
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
        {checkingProtocol ? (
          <span className="text-muted-foreground">{t('service_protocols.widget.checking')}</span>
        ) : activeProtocol ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-muted-foreground">
              {t('service_protocols.widget.protocolExists')}{' '}
              <span className="font-medium text-foreground">{activeProtocol.protocolNumber}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              onClick={() => openProtocolDialog(ticketId, activeProtocol.id, setDialogProtocolId)}
            >
              <ClipboardList size={14} className="mr-1" />
              {t('service_protocols.widget.openProtocol')}
            </Button>
          </div>
        ) : canCreateProtocol ? (
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <ClipboardList size={14} className="mr-1" />
            {createMutation.isPending ? t('service_protocols.widget.creating') : t('service_protocols.widget.createProtocol')}
          </Button>
        ) : (
          <span className="text-muted-foreground">
            {!statusAllowed
              ? t('service_protocols.widget.statusNotAllowed')
              : !hasTechnicians
                ? t('service_protocols.widget.noTechnicians')
                : t('service_protocols.widget.unavailable')}
          </span>
        )}
      </div>

      <Dialog open={!!dialogProtocolId} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownCapture={(e) => {
            e.stopPropagation()
          }}
          onKeyDownCapture={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.stopPropagation()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {protocolDetail
                ? `${t('service_protocols.form.edit.title')} — ${protocolDetail.protocolNumber}`
                : t('service_protocols.form.edit.title')}
            </DialogTitle>
            <DialogDescription>
              {t('service_protocols.widget.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <p className="text-sm text-muted-foreground py-4">{t('service_protocols.widget.checking')}</p>
          ) : dialogReadonly ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">{t('service_protocols.form.error.readonly')}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={closeDialog}>
                {t('service_protocols.form.cancel')}
              </Button>
            </div>
          ) : (
            <form
              className="contents"
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (!saveMutation.isPending) saveMutation.mutate()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  if (!saveMutation.isPending) saveMutation.mutate()
                }
              }}
            >
              <div className="space-y-4 py-2">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('service_protocols.field.workDescription')}</label>
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={4}
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('service_protocols.field.technicianNotes')}</label>
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('service_protocols.field.customerNotes')}</label>
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? t('service_protocols.widget.creating') : t('service_protocols.form.edit.submit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    disabled={saveMutation.isPending}
                  >
                    {t('service_protocols.form.cancel')}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const widget: InjectionWidgetModule<unknown, unknown> = {
  metadata: {
    id: 'service_protocols.injection.ServiceTicketProtocolAction',
    title: 'Service Protocol Action',
    description: 'Create or open a service protocol from a service ticket',
    priority: 50,
    enabled: true,
  },
  Widget: ServiceTicketProtocolActionWidget,
}

export default widget
