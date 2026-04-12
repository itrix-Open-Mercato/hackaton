"use client"
import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Award, Pencil } from 'lucide-react'
import type { TechnicianListItem } from '../../../types'

type ReservationRecord = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  status: 'auto_confirmed' | 'confirmed' | 'cancelled'
  source_type: 'service_ticket' | 'service_order' | 'manual'
  source_ticket_id: string | null
}

type ReservationListResponse = {
  items: ReservationRecord[]
}

export default function TechnicianDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const id = params?.id

  const { data, isLoading } = useQuery({
    queryKey: ['technician-detail', id],
    queryFn: () => fetchCrudList<TechnicianListItem>('technicians/technicians', { id: String(id), pageSize: 1 }),
    enabled: !!id,
  })
  const reservationQuery = useQuery<ReservationListResponse>({
    queryKey: ['technician-detail-reservations', id],
    queryFn: async () => {
      const params = new URLSearchParams({
        technicianId: String(id),
        page: '1',
        pageSize: '10',
        sortField: 'starts_at',
        sortDir: 'asc',
      })
      const call = await apiCallOrThrow<ReservationListResponse>(`/api/technician-reservations?${params.toString()}`)
      return call.result ?? { items: [] }
    },
    enabled: !!id,
  })

  const item = data?.items?.[0] ?? null

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t('technicians.form.loading')}</div>
        ) : !item ? (
          <ErrorMessage label={t('technicians.form.error.notFound')} />
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Link href="/backend/technicians" className="text-sm text-muted-foreground hover:underline">
                  ← {t('technicians.page.title')}
                </Link>
                <h1 className="mt-1 text-xl font-semibold">
                  {item.staffMemberName ?? item.staffMemberId}
                </h1>
              </div>
              <Button asChild>
                <Link href={`/backend/technicians/${id}/edit`}>
                  <Pencil size={14} className="mr-2" />
                  {t('technicians.detail.edit')}
                </Link>
              </Button>
            </div>

            {/* Profile */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-medium">{t('technicians.form.groups.profile')}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('technicians.form.fields.staffMemberId.label')}</span>
                  <p className="mt-0.5 font-medium">{item.staffMemberName ?? '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('technicians.form.fields.isActive.label')}</span>
                  <p className="mt-0.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.isActive ? 'border-green-200 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 bg-gray-50'}`}>
                      {item.isActive ? t('technicians.enum.status.active') : t('technicians.enum.status.inactive')}
                    </span>
                  </p>
                </div>
                {item.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t('technicians.form.fields.notes.label')}</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">{t('technicians.form.groups.skills')}</h3>
              {(item.skillItems ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">{t('technicians.skills.empty')}</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(item.skillItems ?? []).map((s) => (
                    <span key={s.id} className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">{t('technicians.form.groups.certifications')}</h3>
              {(item.certifications ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">{t('technicians.certifications.empty')}</span>
              ) : (
                <div className="space-y-2">
                  {(item.certifications ?? []).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded border px-3 py-2 text-sm">
                      <Award size={14} className={c.isExpired ? 'text-red-500' : 'text-green-500'} />
                      <span className="font-medium">{c.name}</span>
                      {c.certificateNumber && (
                        <span className="text-muted-foreground">#{c.certificateNumber}</span>
                      )}
                      {c.expiresAt && (
                        <span className={c.isExpired ? 'text-red-500' : 'text-muted-foreground'}>
                          {c.isExpired ? t('technicians.certifications.expired') : t('technicians.certifications.expires')}{' '}
                          {new Date(c.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">{t('technicians.detail.schedule', 'Upcoming reservations')}</h3>
              {(reservationQuery.data?.items ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">{t('technicians.detail.scheduleEmpty', 'No reservations found.')}</span>
              ) : (
                <div className="space-y-2">
                  {(reservationQuery.data?.items ?? []).map((reservation) => (
                    <div key={reservation.id} className="rounded border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{reservation.title}</div>
                        {reservation.source_ticket_id ? (
                          <Link href={`/backend/service-tickets/${reservation.source_ticket_id}/edit`} className="text-xs underline underline-offset-2">
                            {t('technicians.detail.openTicket', 'Open ticket')}
                          </Link>
                        ) : null}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {new Date(reservation.starts_at).toLocaleString()} - {new Date(reservation.ends_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  )
}
