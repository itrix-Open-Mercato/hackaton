'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { EmptyState } from '@open-mercato/ui/backend/EmptyState'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@open-mercato/ui/primitives/dialog'
import { ScheduleView, type ScheduleItem, type ScheduleRange, type ScheduleViewMode } from '@open-mercato/ui/backend/schedule'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { parseDateTimeValue } from '../../lib/dateTime'

type ReservationRow = {
  id: string
  title: string
  reservation_type: 'client_visit' | 'internal_work' | 'leave' | 'training' | null
  entry_kind?: 'reservation' | 'availability'
  availability_type?: 'trip' | 'unavailable' | 'holiday' | null
  status: 'auto_confirmed' | 'confirmed' | 'cancelled'
  source_type: 'service_ticket' | 'service_order' | 'manual'
  source_ticket_id: string | null
  source_order_id: string | null
  starts_at: string
  ends_at: string
  all_day?: boolean
  vehicle_id: string | null
  vehicle_label: string | null
  customer_name: string | null
  address: string | null
  notes: string | null
  technicians: string[]
  technician_names?: string[]
}

type ReservationListResponse = {
  items: ReservationRow[]
  total?: number
  totalCount?: number
  page: number
  pageSize: number
  totalPages?: number
}

type TechnicianOption = {
  id: string
  display_name: string
  displayName?: string | null
  staffMemberName?: string | null
}

type TechnicianListResponse = {
  items: TechnicianOption[]
}

type TimedReservationType = NonNullable<ReservationRow['reservation_type']>

const RESERVATION_TYPES: TimedReservationType[] = [
  'client_visit',
  'internal_work',
  'leave',
  'training',
]
const MIN_RENDER_DURATION_MS = 60 * 60 * 1000

function startOfCurrentWeek(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = (day + 6) % 7
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - diff)
  return start
}

function buildDefaultRange(): ScheduleRange {
  const start = startOfCurrentWeek()
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function mapReservationToScheduleItem(row: ReservationRow, t: (key: string, fallback?: string) => string): ScheduleItem {
  const startsAt = parseDateTimeValue(row.starts_at) ?? new Date(0)
  const parsedEndsAt = parseDateTimeValue(row.ends_at)
  const endsAt = parsedEndsAt && parsedEndsAt.getTime() > startsAt.getTime()
    ? parsedEndsAt
    : new Date(startsAt.getTime() + MIN_RENDER_DURATION_MS)
  const kind: ScheduleItem['kind'] =
    row.entry_kind === 'availability'
      ? row.availability_type === 'trip'
        ? 'availability'
        : 'exception'
      : row.reservation_type === 'internal_work'
      ? 'availability'
      : row.reservation_type === 'leave'
        ? 'exception'
        : 'event'

  const subtitle = row.entry_kind === 'availability'
    ? null
    : row.customer_name ?? row.vehicle_label ?? null
  const title = subtitle ? `${row.title} - ${subtitle}` : row.title

  return {
    id: row.id,
    kind,
    title,
    startsAt,
    endsAt,
    status: row.status === 'cancelled' ? 'cancelled' : 'confirmed',
    linkLabel: row.source_ticket_id
      ? t('technicianSchedule.calendar.ticketLink', 'Ticket')
      : row.source_order_id
        ? t('technicianSchedule.calendar.orderLink', 'Order')
        : undefined,
    metadata: {
      reservation: row,
    },
  }
}

function formatReservationDateRange(startValue: string, endValue: string): string {
  const startsAt = parseDateTimeValue(startValue)
  const endsAt = parseDateTimeValue(endValue)
  if (!startsAt || !endsAt) return 'Date unavailable'
  return `${startsAt.toLocaleString()} - ${endsAt.toLocaleString()}`
}

function getReservationDurationMinutes(startValue: string, endValue: string): number {
  const startsAt = parseDateTimeValue(startValue)
  const endsAt = parseDateTimeValue(endValue)
  if (!startsAt || !endsAt) return 0
  return Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000))
}

function formatReservationStatus(
  status: ReservationRow['status'],
  t: (key: string, fallback?: string) => string,
): string {
  const labels: Record<ReservationRow['status'], string> = {
    auto_confirmed: t('technicianSchedule.status.auto_confirmed', 'Auto confirmed'),
    confirmed: t('technicianSchedule.status.confirmed', 'Confirmed'),
    cancelled: t('technicianSchedule.status.cancelled', 'Cancelled'),
  }
  return labels[status]
}

function ReservationTypeToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button type="button" variant={active ? 'default' : 'outline'} size="sm" onClick={onClick}>
      {label}
    </Button>
  )
}

export default function TechnicianSchedulePage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [view, setView] = React.useState<ScheduleViewMode>('week')
  const [range, setRange] = React.useState<ScheduleRange>(() => buildDefaultRange())
  const [selectedTechnicianId, setSelectedTechnicianId] = React.useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = React.useState<TimedReservationType[]>(RESERVATION_TYPES)
  const [selectedReservation, setSelectedReservation] = React.useState<ReservationRow | null>(null)

  const technicianQuery = useQuery<TechnicianListResponse>({
    queryKey: ['technician-schedule-technicians', scopeVersion],
    queryFn: async () => {
      const call = await apiCallOrThrow<TechnicianListResponse>('/api/technicians/technicians?page=1&pageSize=100&is_active=true')
      return call.result ?? { items: [] }
    },
  })

  const reservationQuery = useQuery<ReservationListResponse>({
    queryKey: [
      'technician-schedule-reservations',
      scopeVersion,
      selectedTechnicianId,
      selectedTypes.join(','),
      range.start.toISOString(),
      range.end.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        startsAtFrom: range.start.toISOString(),
        startsAtTo: range.end.toISOString(),
        sortField: 'starts_at',
        sortDir: 'asc',
      })
      if (selectedTechnicianId) params.set('technicianId', selectedTechnicianId)
      if (selectedTypes.length > 0 && selectedTypes.length < RESERVATION_TYPES.length) {
        params.set('reservationTypes', selectedTypes.join(','))
      }
      const call = await apiCallOrThrow<ReservationListResponse>(`/api/technician-reservations?${params.toString()}`)
      return call.result ?? { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 }
    },
  })

  const scheduleItems = React.useMemo(
    () => (reservationQuery.data?.items ?? []).map((row) => mapReservationToScheduleItem(row, t)),
    [reservationQuery.data?.items, t],
  )

  const technicianNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    ;(technicianQuery.data?.items ?? []).forEach((item) => {
      map.set(item.id, item.displayName ?? item.staffMemberName ?? item.display_name ?? item.id)
    })
    return map
  }, [technicianQuery.data?.items])

  const selectedTechnicianLabel = selectedTechnicianId
    ? technicianNameById.get(selectedTechnicianId) ?? t('technicianSchedule.filters.unknownTechnician', 'Unknown technician')
    : t('technicianSchedule.filters.allTechnicians', 'All technicians')

  const reservationCount = reservationQuery.data?.total ?? reservationQuery.data?.totalCount ?? 0

  const handleCancelReservation = React.useCallback(async () => {
    if (!selectedReservation) return
    const confirmed = await confirm({
      title: t('technicianSchedule.confirm.cancel', 'Cancel reservation?'),
      variant: 'destructive',
    })
    if (!confirmed) return

    try {
      await apiCallOrThrow('/api/technician-reservations/cancel', {
        method: 'POST',
        body: JSON.stringify({ id: selectedReservation.id }),
        headers: { 'Content-Type': 'application/json' },
      })
      flash(t('technicianSchedule.flash.cancelled', 'Reservation cancelled.'), 'success')
      setSelectedReservation(null)
      await queryClient.invalidateQueries({ queryKey: ['technician-schedule-reservations'] })
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : t('technicianSchedule.errors.cancelFailed', 'Failed to cancel reservation.')
      flash(message, 'error')
    }
  }, [confirm, queryClient, selectedReservation, t])

  const toolbar = (
    <>
      <Badge variant="outline">
        {selectedTechnicianLabel}
      </Badge>
      <Badge variant="outline">
        {t('technicianSchedule.summary.count', '{{count}} reservations').replace('{{count}}', String(reservationCount))}
      </Badge>
      <Button asChild>
        <Link href="/backend/technician-schedule/create">
          {t('technicianSchedule.actions.add', 'Add reservation')}
        </Link>
      </Button>
    </>
  )

  const typeLabels: Record<NonNullable<ReservationRow['reservation_type']>, string> = {
    client_visit: t('technicianSchedule.type.client_visit', 'Client visit'),
    internal_work: t('technicianSchedule.type.internal_work', 'Internal work'),
    leave: t('technicianSchedule.type.leave', 'Leave'),
    training: t('technicianSchedule.type.training', 'Training'),
  }
  const availabilityTypeLabels: Record<'trip' | 'unavailable' | 'holiday', string> = {
    trip: t('technicians.availability.dayType.trip', 'Trip'),
    unavailable: t('technicians.availability.dayType.unavailable', 'Unavailable'),
    holiday: t('technicians.availability.dayType.holiday', 'Holiday'),
  }

  return (
    <Page>
      <PageHeader
        title={t('technicianSchedule.page.title', 'Technician schedule')}
        description={t('technicianSchedule.page.description', 'Calendar view of technician reservations in the selected date range.')}
        actions={toolbar}
      />
      <PageBody>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <ReservationTypeToggle
                active={selectedTechnicianId === null}
                label={t('technicianSchedule.filters.allTechnicians', 'All technicians')}
                onClick={() => setSelectedTechnicianId(null)}
              />
              {(technicianQuery.data?.items ?? []).map((technician) => (
                <ReservationTypeToggle
                  key={technician.id}
                  active={selectedTechnicianId === technician.id}
                  label={technician.displayName ?? technician.staffMemberName ?? technician.display_name ?? technician.id}
                  onClick={() => setSelectedTechnicianId(technician.id)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RESERVATION_TYPES.map((type) => {
                const active = selectedTypes.includes(type)
                return (
                  <ReservationTypeToggle
                    key={type}
                    active={active}
                    label={typeLabels[type]}
                    onClick={() => {
                      setSelectedTypes((current) => {
                        if (current.includes(type)) {
                          const next = current.filter((entry) => entry !== type)
                          return next.length > 0 ? next : current
                        }
                        return [...current, type]
                      })
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {reservationQuery.isLoading || technicianQuery.isLoading ? (
          <LoadingMessage label={t('technicianSchedule.page.loading', 'Loading schedule...')} />
        ) : reservationQuery.error || technicianQuery.error ? (
          <ErrorMessage
            label={
              reservationQuery.error instanceof Error
                ? reservationQuery.error.message
                : technicianQuery.error instanceof Error
                  ? technicianQuery.error.message
                  : t('technicianSchedule.page.error', 'Failed to load schedule.')
            }
          />
        ) : scheduleItems.length === 0 ? (
          <EmptyState
            title={t('technicianSchedule.page.empty.title', 'No reservations in this range')}
            description={t('technicianSchedule.page.empty.description', 'Try another week or adjust the technician and type filters.')}
            action={{
              label: t('technicianSchedule.actions.add', 'Add reservation'),
              onClick: () => router.push('/backend/technician-schedule/create'),
            }}
          />
        ) : (
          <ScheduleView
            items={scheduleItems}
            view={view}
            range={range}
            onRangeChange={setRange}
            onViewChange={setView}
            onItemClick={(item) => {
              const reservation = item.metadata?.reservation
              if (reservation && typeof reservation === 'object') {
                setSelectedReservation(reservation as ReservationRow)
              }
            }}
            onSlotClick={(slot) => {
              const params = new URLSearchParams({
                startsAt: slot.start.toISOString(),
                endsAt: slot.end.toISOString(),
              })
              router.push(`/backend/technician-schedule/create?${params.toString()}`)
            }}
          />
        )}

        <Dialog open={selectedReservation !== null} onOpenChange={(open) => { if (!open) setSelectedReservation(null) }}>
          {selectedReservation ? (
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedReservation.title}</DialogTitle>
                <DialogDescription>
                  {t('technicianSchedule.details.dialogDescription', 'Reservation details and actions')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                {selectedReservation.reservation_type ? (
                  <Badge variant="secondary">{typeLabels[selectedReservation.reservation_type]}</Badge>
                ) : null}
                {selectedReservation.entry_kind === 'availability' && selectedReservation.availability_type ? (
                  <Badge variant="secondary">{availabilityTypeLabels[selectedReservation.availability_type]}</Badge>
                ) : null}
                <Badge variant={selectedReservation.status === 'cancelled' ? 'destructive' : 'outline'}>
                  {formatReservationStatus(selectedReservation.status, t)}
                </Badge>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.time', 'Time')}</div>
                  <div className="text-muted-foreground">
                    {formatReservationDateRange(selectedReservation.starts_at, selectedReservation.ends_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getReservationDurationMinutes(selectedReservation.starts_at, selectedReservation.ends_at)} min
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.technicians', 'Technicians')}</div>
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    {selectedReservation.technicians.length > 0 ? selectedReservation.technicians.map((id, index) => (
                      <Link
                        key={id}
                        href={`/backend/technicians/${id}`}
                        className="underline underline-offset-2"
                      >
                        {selectedReservation.technician_names?.[index] ?? technicianNameById.get(id) ?? id}
                      </Link>
                    )) : '—'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.customer', 'Customer')}</div>
                  <div className="text-muted-foreground">{selectedReservation.customer_name ?? '—'}</div>
                </div>
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.address', 'Address')}</div>
                  <div className="text-muted-foreground">{selectedReservation.address ?? '—'}</div>
                </div>
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.vehicle', 'Vehicle')}</div>
                  <div className="text-muted-foreground">
                    {selectedReservation.vehicle_id ? (
                      <Link href={`/backend/resources/resources/${selectedReservation.vehicle_id}`} className="underline underline-offset-2">
                        {selectedReservation.vehicle_label ?? selectedReservation.vehicle_id}
                      </Link>
                    ) : (
                      selectedReservation.vehicle_label ?? '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('technicianSchedule.details.source', 'Source')}</div>
                  <div className="text-muted-foreground">
                    {selectedReservation.source_ticket_id ? (
                      <Link href={`/backend/service-tickets/${selectedReservation.source_ticket_id}/edit`} className="underline underline-offset-2">
                        {selectedReservation.source_ticket_id}
                      </Link>
                    ) : selectedReservation.source_order_id ? (
                      <Link href={`/backend/service-orders/${selectedReservation.source_order_id}`} className="underline underline-offset-2">
                        {selectedReservation.source_order_id}
                      </Link>
                    ) : '—'}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="font-medium">{t('technicianSchedule.details.notes', 'Notes')}</div>
                  <div className="text-muted-foreground">{selectedReservation.notes ?? '—'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedReservation.source_type === 'manual' ? (
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={`/backend/technician-schedule/${selectedReservation.id}`}>
                      {t('technicianSchedule.actions.edit', 'Edit')}
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" variant="destructive" size="sm" onClick={handleCancelReservation}>
                  {t('technicianSchedule.actions.cancel', 'Cancel reservation')}
                </Button>
              </div>
            </DialogContent>
          ) : null}
        </Dialog>
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
