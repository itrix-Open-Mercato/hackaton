"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { EnumBadge, type EnumBadgeMap } from '@open-mercato/ui/backend/ValueIcons'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

type ProtocolDetail = {
  id: string
  protocolNumber: string
  serviceTicketId: string
  status: string
  type: string
  customerEntityId: string | null
  machineAssetId: string | null
  ticketDescriptionSnapshot: string | null
  plannedVisitDateSnapshot: string | null
  workDescription: string | null
  technicianNotes: string | null
  customerNotes: string | null
  closedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

type TechnicianLine = { id: string; staffMemberId: string; hoursWorked: number; kmDriven: number; delegationDays: number; isBillable: boolean; kmIsBillable: boolean }
type PartLine = { id: string; nameSnapshot: string; quantityProposed: number; quantityUsed: number; lineStatus: string; isBillable: boolean; unit: string | null }
type HistoryEntry = { id: string; eventType: string; performedByUserId: string | null; performedAt: string | null; notes: string | null; newValue: Record<string, unknown> | null }

function buildStatusMap(t: (key: string) => string): EnumBadgeMap {
  return {
    draft: { label: t('service_protocols.enum.status.draft'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
    in_review: { label: t('service_protocols.enum.status.in_review'), className: 'border-yellow-200 text-yellow-800 bg-yellow-50' },
    approved: { label: t('service_protocols.enum.status.approved'), className: 'border-blue-200 text-blue-700 bg-blue-50' },
    closed: { label: t('service_protocols.enum.status.closed'), className: 'border-green-200 text-green-700 bg-green-50' },
    cancelled: { label: t('service_protocols.enum.status.cancelled'), className: 'border-red-200 text-red-700 bg-red-50' },
  }
}

export default function ServiceProtocolDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params?.id
  const scopeVersion = useOrganizationScopeVersion()
  const statusMap = buildStatusMap(t)

  const [closeConfirm, setCloseConfirm] = React.useState(false)
  const [completeTicket, setCompleteTicket] = React.useState(false)
  const [rejectNotes, setRejectNotes] = React.useState('')
  const [showRejectInput, setShowRejectInput] = React.useState(false)
  const [cancelNotes, setCancelNotes] = React.useState('')
  const [showCancelInput, setShowCancelInput] = React.useState(false)
  const [unlockNotes, setUnlockNotes] = React.useState('')
  const [showUnlockInput, setShowUnlockInput] = React.useState(false)

  const { data: protocolData, isLoading: loadingProtocol, error: protocolError } = useQuery({
    queryKey: ['service_protocol_detail', id, scopeVersion],
    queryFn: async () => {
      const result = await fetchCrudList<ProtocolDetail>('service_protocols/protocols', { id: String(id), pageSize: 1 })
      return result?.items?.[0] ?? null
    },
    enabled: !!id,
  })

  const { data: techniciansData } = useQuery({
    queryKey: ['service_protocol_technicians', id],
    queryFn: async () => fetchCrudList<TechnicianLine>('service_protocols/technicians', { protocolId: String(id), pageSize: 100 }),
    enabled: !!id,
  })

  const { data: partsData } = useQuery({
    queryKey: ['service_protocol_parts', id],
    queryFn: async () => fetchCrudList<PartLine>('service_protocols/parts', { protocolId: String(id), pageSize: 100 }),
    enabled: !!id,
  })

  const { data: historyData } = useQuery({
    queryKey: ['service_protocol_history', id],
    queryFn: async () => fetchCrudList<HistoryEntry>('service_protocols/history', { protocolId: String(id), pageSize: 50 }),
    enabled: !!id,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['service_protocol_detail', id] })
    queryClient.invalidateQueries({ queryKey: ['service_protocol_history', id] })
  }

  const submitMutation = useMutation({
    mutationFn: () => apiCallOrThrow('/api/service_protocols/protocols/submit', { method: 'POST', body: JSON.stringify({ id }) }),
    onSuccess: () => { flash(t('service_protocols.action.submit.success'), 'success'); invalidate() },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  const approveMutation = useMutation({
    mutationFn: () => apiCallOrThrow('/api/service_protocols/protocols/approve', { method: 'POST', body: JSON.stringify({ id }) }),
    onSuccess: () => { flash(t('service_protocols.action.approve.success'), 'success'); invalidate() },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: (notes: string) => apiCallOrThrow('/api/service_protocols/protocols/reject', { method: 'POST', body: JSON.stringify({ id, notes }) }),
    onSuccess: () => { flash(t('service_protocols.action.reject.success'), 'success'); setShowRejectInput(false); setRejectNotes(''); invalidate() },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  const closeMutation = useMutation({
    mutationFn: (complete: boolean) => apiCallOrThrow('/api/service_protocols/protocols/close', { method: 'POST', body: JSON.stringify({ id, complete_service_ticket: complete }) }),
    onSuccess: () => { flash(t('service_protocols.action.close.success'), 'success'); setCloseConfirm(false); invalidate() },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (notes: string | null) => apiCallOrThrow('/api/service_protocols/protocols/cancel', { method: 'POST', body: JSON.stringify({ id, notes }) }),
    onSuccess: () => { flash(t('service_protocols.action.cancel.success'), 'success'); setShowCancelInput(false); setCancelNotes(''); invalidate(); router.push('/backend/service-protocols') },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  const unlockMutation = useMutation({
    mutationFn: (notes: string) => apiCallOrThrow('/api/service_protocols/protocols/unlock', { method: 'POST', body: JSON.stringify({ id, notes }) }),
    onSuccess: () => { flash(t('service_protocols.action.unlock.success'), 'success'); setShowUnlockInput(false); setUnlockNotes(''); invalidate() },
    onError: (err) => flash(err instanceof Error ? err.message : t('service_protocols.action.error'), 'error'),
  })

  if (!id) return null

  if (loadingProtocol) return <Page><PageBody><LoadingMessage /></PageBody></Page>
  if (protocolError || !protocolData) return <Page><PageBody><ErrorMessage label={t('service_protocols.detail.error.load')} /></PageBody></Page>

  const protocol = protocolData
  const technicians = techniciansData?.items ?? []
  const parts = partsData?.items ?? []
  const history = historyData?.items ?? []

  return (
    <Page>
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{protocol.protocolNumber}</h1>
              <div className="flex items-center gap-2 mt-1">
                <EnumBadge value={protocol.status} map={statusMap} />
                <span className="text-sm text-muted-foreground">
                  {t('service_protocols.detail.ticket')}: {protocol.serviceTicketId.slice(0, 8)}…
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/backend/service-protocols">{t('service_protocols.detail.back')}</Link>
              </Button>
              {protocol.status !== 'closed' && protocol.status !== 'cancelled' && (
                <Button variant="outline" asChild>
                  <Link href={`/backend/service-protocols/${id}/edit`}>{t('service_protocols.detail.edit')}</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Work Summary */}
          <section className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{t('service_protocols.detail.section.workSummary')}</h2>
            <div><span className="text-sm text-muted-foreground">{t('service_protocols.field.workDescription')}: </span><span>{protocol.workDescription ?? '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">{t('service_protocols.field.technicianNotes')}: </span><span>{protocol.technicianNotes ?? '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">{t('service_protocols.field.customerNotes')}: </span><span>{protocol.customerNotes ?? '—'}</span></div>
          </section>

          {/* Technicians */}
          <section className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{t('service_protocols.detail.section.technicians')}</h2>
            {technicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('service_protocols.detail.noTechnicians')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-1">{t('service_protocols.technician.staffMemberId')}</th><th className="text-right p-1">{t('service_protocols.technician.hoursWorked')}</th><th className="text-right p-1">{t('service_protocols.technician.kmDriven')}</th><th className="text-right p-1">{t('service_protocols.technician.delegationDays')}</th></tr></thead>
                <tbody>{technicians.map((tech) => (<tr key={tech.id} className="border-b last:border-0"><td className="p-1 font-mono text-xs">{tech.staffMemberId.slice(0, 8)}…</td><td className="p-1 text-right">{tech.hoursWorked}h</td><td className="p-1 text-right">{tech.kmDriven}km</td><td className="p-1 text-right">{tech.delegationDays}d</td></tr>))}</tbody>
              </table>
            )}
          </section>

          {/* Parts */}
          <section className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{t('service_protocols.detail.section.parts')}</h2>
            {parts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('service_protocols.detail.noParts')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-1">{t('service_protocols.part.name')}</th><th className="text-right p-1">{t('service_protocols.part.quantityProposed')}</th><th className="text-right p-1">{t('service_protocols.part.quantityUsed')}</th><th className="text-left p-1">{t('service_protocols.part.lineStatus')}</th></tr></thead>
                <tbody>{parts.map((part) => (<tr key={part.id} className="border-b last:border-0"><td className="p-1">{part.nameSnapshot}</td><td className="p-1 text-right">{part.quantityProposed}</td><td className="p-1 text-right">{part.quantityUsed}</td><td className="p-1"><span className={`text-xs px-1 py-0.5 rounded border ${part.lineStatus === 'removed' ? 'border-red-200 text-red-700' : part.lineStatus === 'confirmed' ? 'border-green-200 text-green-700' : part.lineStatus === 'added' ? 'border-blue-200 text-blue-700' : 'border-yellow-200 text-yellow-700'}`}>{part.lineStatus}</span></td></tr>))}</tbody>
              </table>
            )}
          </section>

          {/* Workflow actions */}
          <section className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{t('service_protocols.detail.section.actions')}</h2>
            <div className="flex flex-wrap gap-2">
              {protocol.status === 'draft' && (
                <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  {t('service_protocols.action.submit')}
                </Button>
              )}
              {protocol.status === 'in_review' && (
                <>
                  <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    {t('service_protocols.action.approve')}
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectInput(!showRejectInput)}>
                    {t('service_protocols.action.reject')}
                  </Button>
                </>
              )}
              {protocol.status === 'approved' && (
                <Button onClick={() => setCloseConfirm(!closeConfirm)}>
                  {t('service_protocols.action.close')}
                </Button>
              )}
              {protocol.status === 'closed' && (
                <Button variant="outline" onClick={() => setShowUnlockInput(!showUnlockInput)}>
                  {t('service_protocols.action.unlock')}
                </Button>
              )}
              {protocol.status !== 'closed' && protocol.status !== 'cancelled' && (
                <Button variant="destructive" onClick={() => setShowCancelInput(!showCancelInput)}>
                  {t('service_protocols.action.cancel')}
                </Button>
              )}
            </div>

            {showRejectInput && (
              <div className="space-y-2">
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  placeholder={t('service_protocols.action.reject.notesPlaceholder')}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                />
                <Button size="sm" onClick={() => rejectMutation.mutate(rejectNotes)} disabled={!rejectNotes.trim() || rejectMutation.isPending}>
                  {t('service_protocols.action.reject.confirm')}
                </Button>
              </div>
            )}

            {closeConfirm && (
              <div className="space-y-2 border rounded p-3 bg-muted/30">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={completeTicket} onChange={(e) => setCompleteTicket(e.target.checked)} />
                  {t('service_protocols.action.close.completeTicket')}
                </label>
                <Button size="sm" onClick={() => closeMutation.mutate(completeTicket)} disabled={closeMutation.isPending}>
                  {t('service_protocols.action.close.confirm')}
                </Button>
              </div>
            )}

            {showCancelInput && (
              <div className="space-y-2">
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={2}
                  placeholder={t('service_protocols.action.cancel.notesPlaceholder')}
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                />
                <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate(cancelNotes || null)} disabled={cancelMutation.isPending}>
                  {t('service_protocols.action.cancel.confirm')}
                </Button>
              </div>
            )}

            {showUnlockInput && (
              <div className="space-y-2">
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={2}
                  placeholder={t('service_protocols.action.unlock.notesPlaceholder')}
                  value={unlockNotes}
                  onChange={(e) => setUnlockNotes(e.target.value)}
                />
                <Button size="sm" onClick={() => unlockMutation.mutate(unlockNotes)} disabled={!unlockNotes.trim() || unlockMutation.isPending}>
                  {t('service_protocols.action.unlock.confirm')}
                </Button>
              </div>
            )}
          </section>

          {/* History */}
          <section className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{t('service_protocols.detail.section.history')}</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('service_protocols.detail.noHistory')}</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{entry.eventType}</span>
                      <span className="text-xs text-muted-foreground">{entry.performedAt ? new Date(entry.performedAt).toLocaleString() : ''}</span>
                    </div>
                    {entry.notes && <p className="text-muted-foreground mt-0.5">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageBody>
    </Page>
  )
}
