"use client"

import * as React from 'react'
import type { CrudField, CrudFormGroup, CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import type { ServiceTicketListItem } from '../types'
import CustomerCascadeSelect from './CustomerCascadeSelect'
import MachineCascadeSelect from './MachineCascadeSelect'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../lib/constants'

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || !address.trim()) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=pl&language=pl&key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) return null
    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  } catch {
    return null
  }
}

function AddressField({ id, value, error, disabled, setValue, setFormValue }: CrudCustomFieldRenderProps) {
  const [geocoding, setGeocoding] = React.useState(false)

  const handleBlur = async () => {
    const address = String(value ?? '').trim()
    if (!address || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return
    setGeocoding(true)
    const coords = await geocodeAddress(address)
    console.log(coords);
    setGeocoding(false)
    if (coords) {
      setFormValue?.('latitude', String(coords.lat))
      setFormValue?.('longitude', String(coords.lng))
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={String(value ?? '')}
        disabled={disabled || geocoding}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {geocoding && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
          Geocoding…
        </span>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export type TicketFormValues = {
  id: string
  service_type: string
  status: string
  priority: string
  description: string
  visit_date: string
  visit_end_date: string
  address: string
  latitude: string
  longitude: string
  customer_entity_id: string
  contact_person_id: string
  machine_instance_id: string
  order_id: string
}

type BuildTicketFormConfigOptions = {
  includeStatus: boolean
}

export function buildTicketFields(
  t: (key: string) => string,
  options: BuildTicketFormConfigOptions,
): CrudField[] {
  const fields: CrudField[] = [
    {
      id: 'service_type',
      label: t('service_tickets.form.fields.serviceType.label'),
      type: 'select',
      required: true,
      options: SERVICE_TYPE_VALUES.map((value) => ({ value, label: t(SERVICE_TYPE_I18N_KEYS[value]) })),
    },
    {
      id: 'priority',
      label: t('service_tickets.form.fields.priority.label'),
      type: 'select',
      options: PRIORITY_VALUES.map((value) => ({ value, label: t(PRIORITY_I18N_KEYS[value]) })),
    },
    {
      id: 'description',
      label: t('service_tickets.form.fields.description.label'),
      type: 'textarea',
      placeholder: t('service_tickets.form.fields.description.placeholder'),
    },
    {
      id: 'visit_date',
      label: t('service_tickets.form.fields.visitDate.label'),
      type: 'datetime-local',
    },
    {
      id: 'visit_end_date',
      label: t('service_tickets.form.fields.visitEndDate.label'),
      type: 'datetime-local',
    },
    {
      id: 'address',
      label: t('service_tickets.form.fields.address.label'),
      type: 'custom',
      component: (props) => <AddressField {...props} />,
    },
    {
      id: 'latitude',
      label: t('service_tickets.form.fields.latitude.label'),
      type: 'number',
      placeholder: t('service_tickets.form.fields.latitude.placeholder'),
    },
    {
      id: 'longitude',
      label: t('service_tickets.form.fields.longitude.label'),
      type: 'number',
      placeholder: t('service_tickets.form.fields.longitude.placeholder'),
    },
    {
      id: 'order_id',
      label: t('service_tickets.form.fields.orderId.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.orderId.placeholder'),
    },
  ]

  if (options.includeStatus) {
    fields.splice(1, 0, {
      id: 'status',
      label: t('service_tickets.form.fields.status.label'),
      type: 'select',
      required: true,
      options: STATUS_VALUES.map((value) => ({ value, label: t(STATUS_I18N_KEYS[value]) })),
    })
  }

  return fields
}

export function buildTicketGroups(
  t: (key: string) => string,
  options: BuildTicketFormConfigOptions,
): CrudFormGroup[] {
  const basicFields = options.includeStatus
    ? ['service_type', 'status', 'priority', 'description']
    : ['service_type', 'priority', 'description']

  return [
    { id: 'basicInfo', title: t('service_tickets.form.groups.basicInfo'), column: 1, fields: basicFields },
    { id: 'schedule', title: t('service_tickets.form.groups.schedule'), column: 1, fields: ['visit_date', 'visit_end_date', 'address', 'latitude', 'longitude'] },
    {
      id: 'links',
      title: t('service_tickets.form.groups.links'),
      column: 2,
      component: ({ values, setValue, errors }) => (
        <div className="space-y-4">
          <MachineCascadeSelect
            machineId={String(values.machine_instance_id ?? '')}
            customerId={String(values.customer_entity_id ?? '')}
            contactPersonId={String(values.contact_person_id ?? '')}
            address={String(values.address ?? '')}
            label={t('service_tickets.form.fields.machineInstanceId.label')}
            placeholder={t('service_tickets.form.fields.machineInstanceId.placeholder')}
            error={errors.machine_instance_id}
            messages={{
              loading: t('service_tickets.form.machineHints.loading'),
              profileTitle: t('service_tickets.form.machineHints.profileTitle'),
              emptyProfile: t('service_tickets.form.machineHints.emptyProfile'),
              machineModelLabel: t('service_tickets.form.machineHints.machineModel'),
              locationLabel: t('service_tickets.form.machineHints.location'),
              serviceDurationLabel: t('service_tickets.form.machineHints.serviceDuration'),
              maintenanceIntervalLabel: t('service_tickets.form.machineHints.maintenanceInterval'),
              serviceNotesLabel: t('service_tickets.form.machineHints.serviceNotes'),
              partsTitle: t('service_tickets.form.machineHints.partsTitle'),
              emptyParts: t('service_tickets.form.machineHints.emptyParts'),
            }}
            setMachineId={(value) => setValue('machine_instance_id', value)}
            setCustomerId={(value) => setValue('customer_entity_id', value)}
            setContactPersonId={(value) => setValue('contact_person_id', value)}
            setAddress={(value) => setValue('address', value)}
          />
          <CustomerCascadeSelect
            companyId={String(values.customer_entity_id ?? '')}
            personId={String(values.contact_person_id ?? '')}
            companyLabel={t('service_tickets.form.fields.customerEntityId.label')}
            personLabel={t('service_tickets.form.fields.contactPersonId.label')}
            companyPlaceholder={t('service_tickets.form.fields.customerEntityId.placeholder')}
            personPlaceholder={t('service_tickets.form.fields.contactPersonId.placeholder')}
            companyError={errors.customer_entity_id}
            personError={errors.contact_person_id}
            setCompanyId={(value) => setValue('customer_entity_id', value)}
            setPersonId={(value) => setValue('contact_person_id', value)}
          />
        </div>
      ),
      fields: ['order_id'],
    },
  ]
}

export function createEmptyTicketFormValues(id = ''): TicketFormValues {
  return {
    id,
    service_type: 'regular',
    status: 'new',
    priority: 'normal',
    description: '',
    visit_date: '',
    visit_end_date: '',
    address: '',
    latitude: '',
    longitude: '',
    customer_entity_id: '',
    contact_person_id: '',
    machine_instance_id: '',
    order_id: '',
  }
}

export function mapTicketToFormValues(item: ServiceTicketListItem): TicketFormValues {
  return {
    id: item.id,
    service_type: item.serviceType,
    status: item.status,
    priority: item.priority,
    description: item.description ?? '',
    visit_date: item.visitDate ? item.visitDate.slice(0, 16) : '',
    visit_end_date: item.visitEndDate ? item.visitEndDate.slice(0, 16) : '',
    address: item.address ?? '',
    latitude: item.latitude != null ? String(item.latitude) : '',
    longitude: item.longitude != null ? String(item.longitude) : '',
    customer_entity_id: item.customerEntityId ?? '',
    contact_person_id: item.contactPersonId ?? '',
    machine_instance_id: item.machineInstanceId ?? '',
    order_id: item.orderId ?? '',
  }
}
