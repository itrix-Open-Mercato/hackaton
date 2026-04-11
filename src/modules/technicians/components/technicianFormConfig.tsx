"use client"

import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'

export type TechnicianFormValues = {
  id: string
  staff_member_id: string
  is_active: string
  notes: string
}

export function buildTechnicianFields(t: (key: string) => string): CrudField[] {
  return [
    {
      id: 'staff_member_id',
      label: t('technicians.form.fields.staffMemberId.label'),
      type: 'text',
      required: true,
      placeholder: t('technicians.form.fields.staffMemberId.placeholder'),
    },
    {
      id: 'is_active',
      label: t('technicians.form.fields.isActive.label'),
      type: 'select',
      options: [
        { value: 'true', label: t('technicians.enum.status.active') },
        { value: 'false', label: t('technicians.enum.status.inactive') },
      ],
    },
    {
      id: 'notes',
      label: t('technicians.form.fields.notes.label'),
      type: 'textarea',
      placeholder: t('technicians.form.fields.notes.placeholder'),
    },
  ]
}

export function buildTechnicianGroups(t: (key: string) => string): CrudFormGroup[] {
  return [
    {
      id: 'profile',
      title: t('technicians.form.groups.profile'),
      column: 1,
      fields: ['staff_member_id', 'is_active', 'notes'],
    },
  ]
}

export function createEmptyTechnicianFormValues(id = ''): TechnicianFormValues {
  return {
    id,
    staff_member_id: '',
    is_active: 'true',
    notes: '',
  }
}

export function mapTechnicianToFormValues(item: Record<string, unknown>): TechnicianFormValues {
  return {
    id: String(item.id ?? ''),
    staff_member_id: String(item.staffMemberId ?? ''),
    is_active: String(item.isActive ?? true),
    notes: String(item.notes ?? ''),
  }
}
