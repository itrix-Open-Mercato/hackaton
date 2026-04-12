"use client"

import * as React from 'react'
import type { CrudField, CrudFormGroup, CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import type { ServiceTicketListItem } from '../types'
import CustomerCascadeSelect from './CustomerCascadeSelect'
import MachineCascadeSelect from './MachineCascadeSelect'
import ServiceTypePicker from './ServiceTypePicker'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../lib/constants'

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
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

function padDateTimePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  return [
    parsed.getFullYear(),
    padDateTimePart(parsed.getMonth() + 1),
    padDateTimePart(parsed.getDate()),
  ].join('-') + `T${padDateTimePart(parsed.getHours())}:${padDateTimePart(parsed.getMinutes())}`
}

function AddressField({ id, value, error, disabled, setValue, setFormValue }: CrudCustomFieldRenderProps) {
  const [geocoding, setGeocoding] = React.useState(false)

  const handleBlur = async () => {
    const address = String(value ?? '').trim()
    if (!address || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return
    setGeocoding(true)
    const coords = await geocodeAddress(address)
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
  staff_member_ids: string[]
  machine_service_type_ids: string[]
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
              maintenanceIntervalLabel: t('service_tickets.form.machineHints.maintenanceInterval'),
              serviceTypesTitle: t('service_tickets.form.machineHints.serviceTypesTitle'),
              emptyServiceTypes: t('service_tickets.form.machineHints.emptyServiceTypes'),
            }}
            setMachineId={(value) => {
              setValue('machine_instance_id', value)
              if (!value) setValue('machine_service_type_ids', [] as any)
            }}
            setCustomerId={(value) => setValue('customer_entity_id', value)}
            setContactPersonId={(value) => setValue('contact_person_id', value)}
            setAddress={(value) => setValue('address', value)}
          />
          <ServiceTypePicker
            machineInstanceId={String(values.machine_instance_id ?? '') || null}
            selectedIds={(values as any).machine_service_type_ids ?? []}
            onChange={(ids) => setValue('machine_service_type_ids', ids as any)}
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
    staff_member_ids: [],
    machine_service_type_ids: [],
  }
}

export function mapTicketToFormValues(item: ServiceTicketListItem): TicketFormValues {
  // The list API returns snake_case (raw DB columns), detail may return camelCase.
  // Handle both casings defensively per CLAUDE.md convention.
  const raw = item as Record<string, unknown>
  const pick = <T,>(camel: string, snake: string): T | undefined =>
    (raw[camel] ?? raw[snake]) as T | undefined

  const visitDate = pick<string>('visitDate', 'visit_date')
  const visitEndDate = pick<string>('visitEndDate', 'visit_end_date')
  const lat = pick<number>('latitude', 'latitude')
  const lng = pick<number>('longitude', 'longitude')
  const staffMemberIds = pick<string[]>('staffMemberIds', 'staff_member_ids')

  return {
    id: item.id,
    service_type: pick<string>('serviceType', 'service_type') ?? '',
    status: pick<string>('status', 'status') ?? '',
    priority: pick<string>('priority', 'priority') ?? '',
    description: pick<string>('description', 'description') ?? '',
    visit_date: toDateTimeLocalValue(visitDate),
    visit_end_date: toDateTimeLocalValue(visitEndDate),
    address: pick<string>('address', 'address') ?? '',
    latitude: lat != null ? String(lat) : '',
    longitude: lng != null ? String(lng) : '',
    customer_entity_id: pick<string>('customerEntityId', 'customer_entity_id') ?? '',
    contact_person_id: pick<string>('contactPersonId', 'contact_person_id') ?? '',
    machine_instance_id: pick<string>('machineInstanceId', 'machine_instance_id') ?? '',
    order_id: pick<string>('orderId', 'order_id') ?? '',
    staff_member_ids: Array.isArray(staffMemberIds) ? staffMemberIds : [],
    machine_service_type_ids: Array.isArray(pick<string[]>('machineServiceTypeIds', 'machine_service_type_ids'))
      ? pick<string[]>('machineServiceTypeIds', 'machine_service_type_ids')!
      : [],
  }
}
