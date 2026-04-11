"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { DetailFieldsSection, ErrorMessage, LoadingMessage, TabEmptyState } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DIRECTION_I18N_KEYS, STATUS_I18N_KEYS } from '../lib/constants'
import type { PhoneCallDetail as PhoneCallDetailType } from '../types'

type ServiceTicketPrefill = {
  phone_call_id: string
  service_type: string
  priority: string
  description: string
  address: string | null
  visit_date: string | null
  customer_entity_id: string | null
  contact_person_id: string | null
  machine_asset_id: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function formatDuration(value: number | null): string {
  if (value == null) return '-'
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}m ${seconds}s`
}

function buildTicketHref(prefill: ServiceTicketPrefill): string {
  const params = new URLSearchParams({
    phone_call_id: prefill.phone_call_id,
    service_type: prefill.service_type,
    priority: prefill.priority,
    description: prefill.description,
  })
  if (prefill.address) params.set('address', prefill.address)
  if (prefill.visit_date) params.set('visit_date', prefill.visit_date)
  if (prefill.customer_entity_id) params.set('customer_entity_id', prefill.customer_entity_id)
  if (prefill.contact_person_id) params.set('contact_person_id', prefill.contact_person_id)
  if (prefill.machine_asset_id) params.set('machine_asset_id', prefill.machine_asset_id)
  return `/backend/service-tickets/create?${params.toString()}`
}

function FieldValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm text-foreground">{value || '-'}</div>
    </div>
  )
}

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value || !Object.keys(value).length) return null
  return (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/20 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function PhoneCallDetail({ callId }: { callId: string }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCreatingTicket, setIsCreatingTicket] = React.useState(false)
  const [artifactAction, setArtifactAction] = React.useState<'generate-transcript' | 'regenerate-summary' | null>(null)

  const { data, isLoading, error } = useQuery<PhoneCallDetailType>({
    queryKey: ['phone_calls', 'detail', callId],
    queryFn: async () => readApiResultOrThrow<PhoneCallDetailType>(`/api/phone_calls/calls/${callId}`),
  })

  const createTicketFromCall = async () => {
    if (!data) return
    setIsCreatingTicket(true)
    try {
      const prefill = await readApiResultOrThrow<ServiceTicketPrefill>(`/api/phone_calls/calls/${data.id}/service-ticket-prefill`)
      router.push(buildTicketHref(prefill))
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.detail.error.prefill')
      flash(message, 'error')
      setIsCreatingTicket(false)
    }
  }

  const runArtifactAction = async (action: 'generate-transcript' | 'regenerate-summary') => {
    if (!data) return
    if (!data.recordingUrl) {
      flash(t('phone_calls.table.error.recordingRequired'), 'error')
      return
    }
    setArtifactAction(action)
    try {
      await apiCallOrThrow(`/api/phone_calls/calls/${data.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recording_url: data.recordingUrl }),
      })
      flash(t(action === 'generate-transcript' ? 'phone_calls.table.flash.transcriptQueued' : 'phone_calls.table.flash.summaryQueued'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['phone_calls'] })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.table.error.artifact')
      flash(message, 'error')
    } finally {
      setArtifactAction(null)
    }
  }

  if (isLoading) return <LoadingMessage label={t('phone_calls.detail.loading')} />
  if (error || !data) {
    return (
      <ErrorMessage
        label={t('phone_calls.detail.error.load')}
        description={error instanceof Error ? error.message : undefined}
      />
    )
  }

  const directionLabel = t(DIRECTION_I18N_KEYS[data.direction])
  const statusLabel = t(STATUS_I18N_KEYS[data.status])
  const activeSummary = data.activeSummary
  const activeTranscript = data.activeTranscript

  return (
    <div className="space-y-5">
      <FormHeader
        mode="detail"
        backHref="/backend/phone-calls"
        title={data.callerPhoneNumber || data.externalCallId}
        entityTypeLabel={t('phone_calls.detail.entityLabel')}
        subtitle={`${formatDateTime(data.startedAt)} / ${data.externalCallId}`}
        statusBadge={<Badge variant="outline">{statusLabel}</Badge>}
        actionsContent={(
          <div className="flex flex-wrap gap-2">
            {data.serviceTicketId ? (
              <Button variant="secondary" asChild>
                <Link href={`/backend/service-tickets/${data.serviceTicketId}/edit`}>{t('phone_calls.detail.actions.openTicket')}</Link>
              </Button>
            ) : (
              <Button onClick={createTicketFromCall} disabled={isCreatingTicket}>
                {isCreatingTicket ? t('phone_calls.detail.actions.creatingTicket') : t('phone_calls.detail.actions.createTicket')}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => { void runArtifactAction('generate-transcript') }}
              disabled={artifactAction != null}
            >
              {artifactAction === 'generate-transcript' ? t('phone_calls.detail.actions.loading') : t('phone_calls.table.actions.generateTranscript')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void runArtifactAction('regenerate-summary') }}
              disabled={artifactAction != null}
            >
              {artifactAction === 'regenerate-summary' ? t('phone_calls.detail.actions.loading') : t('phone_calls.table.actions.regenerateSummary')}
            </Button>
          </div>
        )}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('phone_calls.detail.sections.overview')}</h2>
        <DetailFieldsSection
          fields={[
            {
              key: 'direction',
              kind: 'custom',
              label: t('phone_calls.table.column.direction'),
              emptyLabel: '-',
              render: () => <FieldValue label={t('phone_calls.table.column.direction')} value={directionLabel} />,
            },
            {
              key: 'duration',
              kind: 'custom',
              label: t('phone_calls.table.column.duration'),
              emptyLabel: '-',
              render: () => <FieldValue label={t('phone_calls.table.column.duration')} value={formatDuration(data.durationSeconds)} />,
            },
            {
              key: 'recording',
              kind: 'custom',
              label: t('phone_calls.detail.fields.recording'),
              emptyLabel: '-',
              render: () => (
                <FieldValue
                  label={t('phone_calls.detail.fields.recording')}
                  value={data.recordingUrl ? (
                    <a className="text-primary underline-offset-4 hover:underline" href={data.recordingUrl} target="_blank" rel="noreferrer">
                      {t('phone_calls.detail.fields.openRecording')}
                    </a>
                  ) : '-'}
                />
              ),
            },
            {
              key: 'caller',
              kind: 'custom',
              label: t('phone_calls.table.column.caller'),
              emptyLabel: '-',
              render: () => <FieldValue label={t('phone_calls.table.column.caller')} value={data.callerPhoneNumber ?? '-'} />,
            },
            {
              key: 'callee',
              kind: 'custom',
              label: t('phone_calls.table.column.callee'),
              emptyLabel: '-',
              render: () => <FieldValue label={t('phone_calls.table.column.callee')} value={data.calleePhoneNumber ?? '-'} />,
            },
            {
              key: 'ticket',
              kind: 'custom',
              label: t('phone_calls.table.column.serviceTicket'),
              emptyLabel: '-',
              render: () => (
                <FieldValue
                  label={t('phone_calls.table.column.serviceTicket')}
                  value={data.serviceTicketId ? (
                    <Link className="text-primary underline-offset-4 hover:underline" href={`/backend/service-tickets/${data.serviceTicketId}/edit`}>
                      {data.serviceTicketId}
                    </Link>
                  ) : t('phone_calls.table.noTicket')}
                />
              ),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('phone_calls.detail.sections.summary')}</h2>
        {activeSummary ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm leading-relaxed whitespace-pre-wrap">{activeSummary.summaryText}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldValue label={t('phone_calls.detail.fields.version')} value={`#${activeSummary.versionNo}`} />
              <FieldValue label={t('phone_calls.detail.fields.qualityStatus')} value={activeSummary.qualityStatus} />
              <FieldValue label={t('phone_calls.detail.fields.model')} value={activeSummary.modelName} />
            </div>
            <JsonBlock value={activeSummary.serviceData} />
          </div>
        ) : (
          <TabEmptyState title={t('phone_calls.detail.empty.summary.title')} description={t('phone_calls.detail.empty.summary.description')} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('phone_calls.detail.sections.transcript')}</h2>
        {activeTranscript ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm leading-relaxed whitespace-pre-wrap">{activeTranscript.content}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldValue label={t('phone_calls.detail.fields.version')} value={`#${activeTranscript.versionNo}`} />
              <FieldValue label={t('phone_calls.detail.fields.source')} value={activeTranscript.source} />
              <FieldValue label={t('phone_calls.detail.fields.language')} value={activeTranscript.languageCode ?? '-'} />
            </div>
          </div>
        ) : (
          <TabEmptyState title={t('phone_calls.detail.empty.transcript.title')} description={t('phone_calls.detail.empty.transcript.description')} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('phone_calls.detail.sections.history')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('phone_calls.detail.sections.summaryVersions')}</h3>
            {data.summaryVersions.length ? data.summaryVersions.map((version) => (
              <FieldValue
                key={version.id}
                label={`#${version.versionNo} / ${formatDateTime(version.createdAt)}`}
                value={`${version.qualityStatus}${version.isActive ? ` / ${t('phone_calls.detail.fields.active')}` : ''}`}
              />
            )) : <TabEmptyState title={t('phone_calls.detail.empty.versions')} />}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('phone_calls.detail.sections.transcriptVersions')}</h3>
            {data.transcriptVersions.length ? data.transcriptVersions.map((version) => (
              <FieldValue
                key={version.id}
                label={`#${version.versionNo} / ${formatDateTime(version.createdAt)}`}
                value={`${version.source}${version.isActive ? ` / ${t('phone_calls.detail.fields.active')}` : ''}`}
              />
            )) : <TabEmptyState title={t('phone_calls.detail.empty.versions')} />}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('phone_calls.detail.sections.raw')}</h2>
        <JsonBlock value={data.rawSnapshot} />
        {!data.rawSnapshot ? <TabEmptyState title={t('phone_calls.detail.empty.raw')} /> : null}
      </section>
    </div>
  )
}
