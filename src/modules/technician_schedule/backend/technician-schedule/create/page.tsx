'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useReservationFormConfig, type ReservationFormValues } from '../../../components/form'

type TechnicianOption = {
  id: string
  display_name: string
  displayName?: string | null
  staffMemberName?: string | null
}

type TechnicianListResponse = {
  items: TechnicianOption[]
}

export default function CreateTechnicianReservationPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()

  const technicianQuery = useQuery<TechnicianListResponse>({
    queryKey: ['technician-schedule-technicians-create'],
    queryFn: async () => {
      const call = await apiCallOrThrow<TechnicianListResponse>('/api/technicians/technicians?page=1&pageSize=100&is_active=true')
      return call.result ?? { items: [] }
    },
  })

  const initialValues = React.useMemo<Partial<ReservationFormValues>>(() => ({
    reservationType: 'client_visit',
    startsAt: searchParams.get('startsAt') ?? undefined,
    endsAt: searchParams.get('endsAt') ?? undefined,
    technicianIds: [],
  }), [searchParams])
  const { fields, groups } = useReservationFormConfig(technicianQuery.data?.items ?? [])

  if (technicianQuery.isLoading) {
    return <LoadingMessage label={t('technicianSchedule.page.loading', 'Loading schedule...')} />
  }

  if (technicianQuery.error) {
    return <ErrorMessage label={technicianQuery.error instanceof Error ? technicianQuery.error.message : t('technicianSchedule.page.error', 'Failed to load schedule.')} />
  }

  return (
    <Page>
      <PageBody>
        <CrudForm<ReservationFormValues>
          title={t('technicianSchedule.form.create.title', 'New reservation')}
          backHref="/backend/technician-schedule"
          entityId="technician_schedule:technician_reservation"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('technicianSchedule.form.create.submit', 'Create reservation')}
          cancelHref="/backend/technician-schedule"
          onSubmit={async (values) => {
            if (!values.startsAt || !values.endsAt || new Date(values.endsAt).getTime() <= new Date(values.startsAt).getTime()) {
              throw createCrudFormError(t('technicianSchedule.form.errors.invalidRange', 'End time must be after start time.'))
            }
            if (!Array.isArray(values.technicianIds) || values.technicianIds.length === 0) {
              throw createCrudFormError(t('technicianSchedule.form.errors.technicianRequired', 'Select at least one technician.'))
            }

            await createCrud('technician-reservations', values)
            flash(t('technicianSchedule.flash.created', 'Reservation created.'), 'success')
            router.push('/backend/technician-schedule')
          }}
        />
      </PageBody>
    </Page>
  )
}
