"use client"

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { PhoneCallHealth, PhoneCallRetentionPruneResult } from '../types'

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' | 'danger' }) {
  const toneClass = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-800'
    : tone === 'warning'
      ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
      : 'border-border bg-muted/20'
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

export default function PhoneCallOperations() {
  const t = useT()
  const queryClient = useQueryClient()
  const [isPruning, setIsPruning] = React.useState(false)
  const [lastPrune, setLastPrune] = React.useState<PhoneCallRetentionPruneResult | null>(null)

  const { data, isLoading, error } = useQuery<PhoneCallHealth>({
    queryKey: ['phone_calls', 'operations', 'health'],
    queryFn: async () => readApiResultOrThrow<PhoneCallHealth>('/api/phone_calls/operations/health'),
  })

  const runDryRun = async () => {
    setIsPruning(true)
    try {
      const response = await apiCallOrThrow<PhoneCallRetentionPruneResult>('/api/phone_calls/retention/prune', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })
      if (response.result) setLastPrune(response.result)
      flash(t('phone_calls.operations.flash.retentionChecked'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['phone_calls', 'operations'] })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.operations.error.prune')
      flash(message, 'error')
    } finally {
      setIsPruning(false)
    }
  }

  return (
    <div className="space-y-5">
      <FormHeader
        mode="detail"
        backHref="/backend/phone-calls"
        title={t('phone_calls.operations.title')}
        entityTypeLabel={t('phone_calls.operations.entityLabel')}
        subtitle={t('phone_calls.operations.description')}
        actionsContent={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href="/backend/phone-calls/settings">{t('phone_calls.table.actions.settings')}</Link>
            </Button>
            <Button onClick={runDryRun} disabled={isPruning}>
              {isPruning ? t('phone_calls.operations.actions.checkingRetention') : t('phone_calls.operations.actions.checkRetention')}
            </Button>
          </div>
        )}
      />

      {isLoading ? <LoadingMessage label={t('phone_calls.operations.loading')} /> : null}
      {error ? (
        <ErrorMessage
          label={t('phone_calls.operations.error.load')}
          description={error instanceof Error ? error.message : undefined}
        />
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.configured ? 'default' : 'destructive'}>
              {data.configured ? t('phone_calls.operations.configured.yes') : t('phone_calls.operations.configured.no')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t('phone_calls.operations.lastSyncedAt')}: {formatDateTime(data.lastSyncedAt)}
            </span>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label={t('phone_calls.operations.stats.callsTotal')} value={data.callsTotal} />
            <Stat label={t('phone_calls.operations.stats.callsWithoutServiceTicket')} value={data.callsWithoutServiceTicket} tone={data.callsWithoutServiceTicket ? 'warning' : undefined} />
            <Stat label={t('phone_calls.operations.stats.callsWithoutSummary')} value={data.callsWithoutSummary} tone={data.callsWithoutSummary ? 'warning' : undefined} />
            <Stat label={t('phone_calls.operations.stats.callsRecordingPending')} value={data.callsRecordingPending} tone={data.callsRecordingPending ? 'warning' : undefined} />
            <Stat label={t('phone_calls.operations.stats.failedIngestEvents24h')} value={data.failedIngestEvents24h} tone={data.failedIngestEvents24h ? 'danger' : undefined} />
            <Stat label={t('phone_calls.operations.stats.oldestPendingIngestEventAt')} value={formatDateTime(data.oldestPendingIngestEventAt)} tone={data.oldestPendingIngestEventAt ? 'warning' : undefined} />
          </section>
        </>
      ) : null}

      {lastPrune ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t('phone_calls.operations.retention.title')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t('phone_calls.operations.retention.transcriptVersions')} value={lastPrune.transcriptVersions} />
            <Stat label={t('phone_calls.operations.retention.summaryVersions')} value={lastPrune.summaryVersions} />
            <Stat label={t('phone_calls.operations.retention.ingestEvents')} value={lastPrune.ingestEvents} />
          </div>
        </section>
      ) : null}
    </div>
  )
}
