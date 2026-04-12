'use client'

import * as React from 'react'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type TechnicianOption = {
  id: string
  display_name: string
  displayName?: string | null
  staffMemberName?: string | null
}

export type ReservationFormValues = {
  reservationType: 'client_visit' | 'internal_work' | 'leave' | 'training'
  startsAt: string
  endsAt: string
  technicianIds: string[]
  vehicleId?: string
  vehicleLabel?: string
  customerName?: string
  address?: string
  notes?: string
}

export function useReservationFormConfig(technicians: TechnicianOption[]) {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'reservationType',
      label: t('technicianSchedule.form.fields.reservationType', 'Reservation type'),
      type: 'select',
      required: true,
      options: [
        { value: 'client_visit', label: t('technicianSchedule.type.client_visit', 'Client visit') },
        { value: 'internal_work', label: t('technicianSchedule.type.internal_work', 'Internal work') },
        { value: 'leave', label: t('technicianSchedule.type.leave', 'Leave') },
        { value: 'training', label: t('technicianSchedule.type.training', 'Training') },
      ],
    },
    {
      id: 'startsAt',
      label: t('technicianSchedule.form.fields.startsAt', 'Start'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'endsAt',
      label: t('technicianSchedule.form.fields.endsAt', 'End'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'technicianIds',
      label: t('technicianSchedule.form.fields.technicians', 'Technicians'),
      type: 'select',
      required: true,
      multiple: true,
      options: technicians.map((item) => ({ value: item.id, label: item.displayName ?? item.staffMemberName ?? item.display_name ?? item.id })),
    },
    {
      id: 'vehicleId',
      label: t('technicianSchedule.form.fields.vehicleId', 'Vehicle ID'),
      type: 'text',
    },
    {
      id: 'vehicleLabel',
      label: t('technicianSchedule.form.fields.vehicleLabel', 'Vehicle label'),
      type: 'text',
    },
    {
      id: 'customerName',
      label: t('technicianSchedule.form.fields.customerName', 'Customer name'),
      type: 'text',
    },
    {
      id: 'address',
      label: t('technicianSchedule.form.fields.address', 'Address'),
      type: 'textarea',
    },
    {
      id: 'notes',
      label: t('technicianSchedule.form.fields.notes', 'Notes'),
      type: 'textarea',
    },
  ], [t, technicians])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'type',
      title: t('technicianSchedule.form.groups.type', 'Type'),
      column: 1,
      fields: ['reservationType'],
    },
    {
      id: 'time',
      title: t('technicianSchedule.form.groups.time', 'Time slot'),
      column: 1,
      fields: ['startsAt', 'endsAt'],
    },
    {
      id: 'technicians',
      title: t('technicianSchedule.form.groups.technicians', 'Technicians'),
      column: 2,
      fields: ['technicianIds'],
    },
    {
      id: 'vehicle',
      title: t('technicianSchedule.form.groups.vehicle', 'Vehicle'),
      column: 2,
      fields: ['vehicleId', 'vehicleLabel'],
    },
    {
      id: 'trip',
      title: t('technicianSchedule.form.groups.trip', 'Trip details'),
      column: 1,
      fields: ['customerName', 'address'],
    },
    {
      id: 'notes',
      title: t('technicianSchedule.form.groups.notes', 'Notes'),
      column: 1,
      fields: ['notes'],
    },
  ], [t])

  return { fields, groups }
}
