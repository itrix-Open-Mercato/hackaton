'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useReservationFormConfig, type ReservationFormValues } from '../../../components/form'

type TechnicianOption = {
  id: string
  display_name: string
}

type TechnicianListResponse = {
  items: TechnicianOption[]
}

type ReservationRecord = {
  id: string
  source_type: 'service_order' | 'manual'
  reservation_type: ReservationFormValues['reservationType']
  starts_at: string
  ends_at: string
  vehicle_id: string | null
  vehicle_label: string | null
  customer_name: string | null
  address: string | null
  notes: string | null
  technicians: string[]
}

type ReservationListResponse = {
  items: ReservationRecord[]
}

export default function EditTechnicianReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT()
  const router = useRouter()
  const resolvedParams = React.use(params)
  const reservationId = resolvedParams.id

  const technicianQuery = useQuery<TechnicianListResponse>({
    queryKey: ['technician-schedule-technicians-edit'],
    queryFn: async () => {
      const call = await apiCallOrThrow<TechnicianListResponse>('/api/field-technicians?page=1&pageSize=100&isActive=true')
      return call.result ?? { items: [] }
    },
  })

  const reservationQuery = useQuery<ReservationRecord | null>({
    queryKey: ['technician-schedule-reservation', reservationId],
    queryFn: async () => {
      const call = await apiCallOrThrow<ReservationListResponse>(`/api/technician-reservations?ids=${encodeURIComponent(reservationId)}&page=1&pageSize=1`)
      return call.result?.items?.[0] ?? null
    },
  })

  const { fields, groups } = useReservationFormConfig(technicianQuery.data?.items ?? [])

  const initialValues = React.useMemo<Partial<ReservationFormValues> | undefined>(() => {
    const reservation = reservationQuery.data
    if (!reservation) return undefined

    return {
      reservationType: reservation.reservation_type,
      startsAt: reservation.starts_at,
      endsAt: reservation.ends_at,
      technicianIds: reservation.technicians ?? [],
      vehicleId: reservation.vehicle_id ?? undefined,
      vehicleLabel: reservation.vehicle_label ?? undefined,
      customerName: reservation.customer_name ?? undefined,
      address: reservation.address ?? undefined,
      notes: reservation.notes ?? undefined,
    }
  }, [reservationQuery.data])

  if (technicianQuery.isLoading || reservationQuery.isLoading) {
    return <LoadingMessage label={t('technicianSchedule.page.loading', 'Loading schedule...')} />
  }

  if (technicianQuery.error || reservationQuery.error) {
    return (
      <ErrorMessage
        label={
          reservationQuery.error instanceof Error
            ? reservationQuery.error.message
            : technicianQuery.error instanceof Error
              ? technicianQuery.error.message
              : t('technicianSchedule.page.error', 'Failed to load schedule.')
        }
      />
    )
  }

  if (!reservationQuery.data) {
    return <ErrorMessage label={t('technicianSchedule.form.errors.notFound', 'Reservation not found.')} />
  }

  if (reservationQuery.data.source_type !== 'manual') {
    return <ErrorMessage label={t('technicianSchedule.form.errors.editLocked', 'Only manual reservations can be edited.')} />
  }

  return (
    <Page>
      <PageBody>
        <CrudForm<ReservationFormValues>
          title={t('technicianSchedule.form.edit.title', 'Edit reservation')}
          backHref="/backend/technician-schedule"
          entityId="technician_schedule:technician_reservation"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('technicianSchedule.form.edit.submit', 'Save changes')}
          cancelHref="/backend/technician-schedule"
          onSubmit={async (values) => {
            if (!values.startsAt || !values.endsAt || new Date(values.endsAt).getTime() <= new Date(values.startsAt).getTime()) {
              throw createCrudFormError(t('technicianSchedule.form.errors.invalidRange', 'End time must be after start time.'))
            }
            if (!Array.isArray(values.technicianIds) || values.technicianIds.length === 0) {
              throw createCrudFormError(t('technicianSchedule.form.errors.technicianRequired', 'Select at least one technician.'))
            }

            await updateCrud('technician-reservations', {
              id: reservationId,
              ...values,
            })
            flash(t('technicianSchedule.flash.updated', 'Reservation updated.'), 'success')
            router.push('/backend/technician-schedule')
          }}
        />
      </PageBody>
    </Page>
  )
}
