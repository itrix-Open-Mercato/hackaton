"use client"

import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import type { ServiceTicketListItem } from '../types'
import CustomerCascadeSelect from './CustomerCascadeSelect'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../lib/constants'

export type TicketFormValues = {
  id: string
  service_type: string
  status: string
  priority: string
  description: string
  visit_date: string
  visit_end_date: string
  address: string
  customer_entity_id: string
  contact_person_id: string
  machine_asset_id: string
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
      type: 'text',
      placeholder: t('service_tickets.form.fields.address.placeholder'),
    },
    {
      id: 'machine_asset_id',
      label: t('service_tickets.form.fields.machineAssetId.label'),
      type: 'text',
      placeholder: t('service_tickets.form.fields.machineAssetId.placeholder'),
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
    { id: 'schedule', title: t('service_tickets.form.groups.schedule'), column: 1, fields: ['visit_date', 'visit_end_date', 'address'] },
    {
      id: 'links',
      title: t('service_tickets.form.groups.links'),
      column: 2,
      component: ({ values, setValue, errors }) => (
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
      ),
      fields: ['machine_asset_id', 'order_id'],
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
    customer_entity_id: '',
    contact_person_id: '',
    machine_asset_id: '',
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
    customer_entity_id: item.customerEntityId ?? '',
    contact_person_id: item.contactPersonId ?? '',
    machine_asset_id: item.machineAssetId ?? '',
    order_id: item.orderId ?? '',
  }
}
