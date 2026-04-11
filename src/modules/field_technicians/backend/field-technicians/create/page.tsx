"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateFieldTechnicianPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'firstName',
      label: t('fieldTechnicians.form.fields.firstName.label', 'First name'),
      type: 'text',
      required: true,
      placeholder: t('fieldTechnicians.form.fields.firstName.placeholder', 'Jan'),
    },
    {
      id: 'lastName',
      label: t('fieldTechnicians.form.fields.lastName.label', 'Last name'),
      type: 'text',
      required: true,
      placeholder: t('fieldTechnicians.form.fields.lastName.placeholder', 'Kowalski'),
    },
    {
      id: 'email',
      label: t('fieldTechnicians.form.fields.email.label', 'Email'),
      type: 'text',
      placeholder: 'jan.kowalski@firma.pl',
    },
    {
      id: 'phone',
      label: t('fieldTechnicians.form.fields.phone.label', 'Phone'),
      type: 'text',
      placeholder: '+48 600 000 000',
    },
    {
      id: 'locationStatus',
      label: t('fieldTechnicians.form.fields.locationStatus.label', 'Current location'),
      type: 'select',
      options: [
        { value: 'in_office', label: t('fieldTechnicians.locationStatus.in_office', 'In office') },
        { value: 'on_trip', label: t('fieldTechnicians.locationStatus.on_trip', 'On trip / Delegation') },
        { value: 'at_client', label: t('fieldTechnicians.locationStatus.at_client', 'At client site') },
        { value: 'unavailable', label: t('fieldTechnicians.locationStatus.unavailable', 'Unavailable') },
      ],
    },
    {
      id: 'skills',
      label: t('fieldTechnicians.form.fields.skills.label', 'Skills / Specializations'),
      type: 'tags',
      placeholder: t('fieldTechnicians.form.fields.skills.placeholder', 'laser, CNC, druk 3D, klimatyzacja…'),
      help: t('fieldTechnicians.form.fields.skills.help', 'Add skill tags separated by Enter or comma. Used for technician matching.'),
    },
    {
      id: 'languages',
      label: t('fieldTechnicians.form.fields.languages.label', 'Languages'),
      type: 'tags',
      placeholder: t('fieldTechnicians.form.fields.languages.placeholder', 'PL, EN, DE…'),
      help: t('fieldTechnicians.form.fields.languages.help', 'Add language codes. Important for international assignments.'),
    },
    {
      id: 'notes',
      label: t('fieldTechnicians.form.fields.notes.label', 'Notes'),
      type: 'textarea',
      placeholder: t('fieldTechnicians.form.fields.notes.placeholder', 'Additional information about the technician…'),
    },
    {
      id: 'isActive',
      label: t('fieldTechnicians.form.fields.isActive.label', 'Active'),
      type: 'checkbox',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'identity',
      title: t('fieldTechnicians.form.groups.identity', 'Identity'),
      column: 1,
      fields: ['firstName', 'lastName'],
    },
    {
      id: 'contact',
      title: t('fieldTechnicians.form.groups.contact', 'Contact'),
      column: 1,
      fields: ['email', 'phone'],
    },
    {
      id: 'status',
      title: t('fieldTechnicians.form.groups.status', 'Status'),
      column: 2,
      fields: ['locationStatus', 'isActive'],
    },
    {
      id: 'competencies',
      title: t('fieldTechnicians.form.groups.competencies', 'Competencies'),
      column: 2,
      fields: ['skills', 'languages'],
    },
    {
      id: 'notes',
      title: t('fieldTechnicians.form.groups.notes', 'Notes'),
      column: 1,
      fields: ['notes'],
    },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/field-technicians?flash=${encodeURIComponent(t('fieldTechnicians.form.flash.created', 'Technician created.'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('fieldTechnicians.form.create.title', 'New technician')}
          backHref="/backend/field-technicians"
          entityId="field_technicians:field_technician"
          fields={fields}
          groups={groups}
          submitLabel={t('fieldTechnicians.form.create.submit', 'Create technician')}
          cancelHref="/backend/field-technicians"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('field-technicians', vals) }}
        />
      </PageBody>
    </Page>
  )
}
