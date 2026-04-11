"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud, createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { AlertTriangle, Plus, Trash2, ExternalLink, Wrench, MapPin, Languages, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

type TechnicianRecord = {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  location_status: string
  skills: string[]
  languages: string[]
  notes: string | null
  staff_member_id: string | null
  vehicle_id: string | null
  vehicle_label: string | null
  current_order_id: string | null
  is_active: boolean
}

type AvailabilityDayType = 'work_day' | 'trip' | 'unavailable' | 'holiday'

type AvailabilityRecord = {
  id: string
  technician_id: string
  date: string
  day_type: AvailabilityDayType
  notes: string | null
}

const DAY_TYPE_COLORS: Record<AvailabilityDayType, string> = {
  work_day: 'bg-green-500 text-white',
  trip: 'bg-blue-500 text-white',
  unavailable: 'bg-gray-400 text-white',
  holiday: 'bg-amber-400 text-white',
}

const DAY_TYPE_LABELS_KEY: Record<AvailabilityDayType, string> = {
  work_day: 'fieldTechnicians.availability.dayType.work_day',
  trip: 'fieldTechnicians.availability.dayType.trip',
  unavailable: 'fieldTechnicians.availability.dayType.unavailable',
  holiday: 'fieldTechnicians.availability.dayType.holiday',
}

const DAY_TYPE_CYCLE: Array<AvailabilityDayType | null> = ['work_day', 'trip', 'unavailable', 'holiday', null]

type CertificationRecord = {
  id: string
  technician_id: string
  name: string
  cert_type: string | null
  code: string | null
  issued_at: string | null
  expires_at: string | null
  issued_by: string | null
  notes: string | null
}

const LOCATION_STATUS_COLORS: Record<string, string> = {
  in_office: 'bg-green-100 text-green-800 border-green-200',
  on_trip: 'bg-blue-100 text-blue-800 border-blue-200',
  at_client: 'bg-amber-100 text-amber-800 border-amber-200',
  unavailable: 'bg-gray-100 text-gray-600 border-gray-200',
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const expiry = new Date(expiresAt)
  const now = new Date()
  const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

function formatDate(dateStr: string | null, t: (k: string, fb?: string) => string): string {
  if (!dateStr) return t('fieldTechnicians.detail.noDate', '—')
  return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type TechFormValues = {
  id: string
  displayName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  locationStatus: string
  skills: string[]
  languages: string[]
  notes: string | null
  isActive: boolean
}

export default function FieldTechnicianDetailPage({ params }: { params?: { id?: string } }) {
  const technicianId = params?.id
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [activeTab, setActiveTab] = React.useState<'overview' | 'certifications' | 'availability' | 'edit'>('overview')
  const [showAddCert, setShowAddCert] = React.useState(false)
  const [calendarYear, setCalendarYear] = React.useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date().getMonth())
  const [savingDate, setSavingDate] = React.useState<string | null>(null)

  const { data: technicianData } = useQuery({
    queryKey: ['field-technician', technicianId],
    queryFn: async () => {
      if (!technicianId) return null
      const result = await fetchCrudList<TechnicianRecord>('field-technicians', { id: technicianId, pageSize: 1 })
      return result?.items?.[0] ?? null
    },
    enabled: !!technicianId,
  })

  const { data: certsData, refetch: refetchCerts } = useQuery({
    queryKey: ['field-technician-certs', technicianId],
    queryFn: async () => {
      if (!technicianId) return { items: [] }
      return fetchCrudList<CertificationRecord>('field-technicians/certifications', {
        technicianId,
        pageSize: 100,
        sortField: 'expires_at',
        sortDir: 'asc',
      })
    },
    enabled: !!technicianId && activeTab === 'certifications',
  })

  const availabilityDateFrom = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const availabilityDateTo = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: availabilityData, refetch: refetchAvailability } = useQuery({
    queryKey: ['field-technician-availability', technicianId, calendarYear, calendarMonth],
    queryFn: async () => {
      if (!technicianId) return { items: [] }
      return fetchCrudList<AvailabilityRecord>('field-technicians/availability', {
        technicianId,
        dateFrom: availabilityDateFrom,
        dateTo: availabilityDateTo,
        pageSize: 100,
        sortField: 'date',
        sortDir: 'asc',
      })
    },
    enabled: !!technicianId && activeTab === 'availability',
  })

  const availabilityByDate = React.useMemo(() => {
    const map: Record<string, AvailabilityRecord> = {}
    for (const rec of (availabilityData?.items ?? [])) {
      const dateKey = String(rec.date).slice(0, 10)
      map[dateKey] = { ...rec, date: dateKey }
    }
    return map
  }, [availabilityData])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCrud('field-technicians', id),
    onSuccess: () => {
      flash(t('fieldTechnicians.detail.flash.deleted', 'Technician deleted.'), 'success')
      router.push('/backend/field-technicians')
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t('fieldTechnicians.detail.error.delete', 'Failed to delete.')
      flash(message, 'error')
    },
  })

  const deleteCertMutation = useMutation({
    mutationFn: (id: string) => deleteCrud('field-technicians/certifications', id),
    onSuccess: () => {
      flash(t('fieldTechnicians.detail.flash.certDeleted', 'Certification removed.'), 'success')
      refetchCerts()
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t('fieldTechnicians.detail.error.deleteCert', 'Failed to remove.')
      flash(message, 'error')
    },
  })

  const technician = technicianData

  const editFields = React.useMemo<CrudField[]>(() => [
    {
      id: 'firstName',
      label: t('fieldTechnicians.form.fields.firstName.label', 'First name'),
      type: 'text',
      required: true,
    },
    {
      id: 'lastName',
      label: t('fieldTechnicians.form.fields.lastName.label', 'Last name'),
      type: 'text',
      required: true,
    },
    {
      id: 'email',
      label: t('fieldTechnicians.form.fields.email.label', 'Email'),
      type: 'text',
    },
    {
      id: 'phone',
      label: t('fieldTechnicians.form.fields.phone.label', 'Phone'),
      type: 'text',
    },
    {
      id: 'locationStatus',
      label: t('fieldTechnicians.form.fields.locationStatus.label', 'Current location'),
      type: 'select',
      options: [
        { value: 'in_office', label: t('fieldTechnicians.locationStatus.in_office', 'In office') },
        { value: 'on_trip', label: t('fieldTechnicians.locationStatus.on_trip', 'On trip') },
        { value: 'at_client', label: t('fieldTechnicians.locationStatus.at_client', 'At client site') },
        { value: 'unavailable', label: t('fieldTechnicians.locationStatus.unavailable', 'Unavailable') },
      ],
    },
    {
      id: 'skills',
      label: t('fieldTechnicians.form.fields.skills.label', 'Skills'),
      type: 'tags',
    },
    {
      id: 'languages',
      label: t('fieldTechnicians.form.fields.languages.label', 'Languages'),
      type: 'tags',
    },
    {
      id: 'notes',
      label: t('fieldTechnicians.form.fields.notes.label', 'Notes'),
      type: 'textarea',
    },
    {
      id: 'isActive',
      label: t('fieldTechnicians.form.fields.isActive.label', 'Active'),
      type: 'checkbox',
    },
  ], [t])

  const editGroups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('fieldTechnicians.form.groups.identity', 'Identity'), column: 1, fields: ['firstName', 'lastName'] },
    { id: 'contact', title: t('fieldTechnicians.form.groups.contact', 'Contact'), column: 1, fields: ['email', 'phone'] },
    { id: 'status', title: t('fieldTechnicians.form.groups.status', 'Status'), column: 2, fields: ['locationStatus', 'isActive'] },
    { id: 'competencies', title: t('fieldTechnicians.form.groups.competencies', 'Competencies'), column: 2, fields: ['skills', 'languages'] },
    { id: 'notes', title: t('fieldTechnicians.form.groups.notes', 'Notes'), column: 1, fields: ['notes'] },
  ], [t])

  const certFields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('fieldTechnicians.cert.form.name', 'Certificate name'), type: 'text', required: true, placeholder: 'np. SEP do 1kV, Prawo jazdy kat. B' },
    {
      id: 'certType',
      label: t('fieldTechnicians.cert.form.certType', 'Type'),
      type: 'select',
      options: [
        { value: 'sep', label: 'SEP' },
        { value: 'driving_license', label: t('fieldTechnicians.cert.type.driving_license', 'Driving license') },
        { value: 'other', label: t('fieldTechnicians.cert.type.other', 'Other') },
      ],
    },
    { id: 'code', label: t('fieldTechnicians.cert.form.code', 'Certificate number'), type: 'text', placeholder: 'Nr certyfikatu / uprawnienia' },
    { id: 'issuedAt', label: t('fieldTechnicians.cert.form.issuedAt', 'Issued date'), type: 'date' },
    { id: 'expiresAt', label: t('fieldTechnicians.cert.form.expiresAt', 'Expiry date'), type: 'date' },
    { id: 'issuedBy', label: t('fieldTechnicians.cert.form.issuedBy', 'Issued by'), type: 'text', placeholder: 'Urząd / instytucja wystawiająca' },
    { id: 'notes', label: t('fieldTechnicians.cert.form.notes', 'Notes'), type: 'textarea' },
  ], [t])

  const certGroups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'main', title: t('fieldTechnicians.cert.form.group.main', 'Certificate details'), column: 1, fields: ['name', 'certType', 'code'] },
    { id: 'dates', title: t('fieldTechnicians.cert.form.group.dates', 'Validity'), column: 2, fields: ['issuedAt', 'expiresAt', 'issuedBy'] },
    { id: 'extra', title: t('fieldTechnicians.cert.form.group.extra', 'Additional info'), column: 1, fields: ['notes'] },
  ], [t])

  const initialEditValues = React.useMemo<TechFormValues | undefined>(() => {
    if (!technician) return undefined
    return {
      id: technician.id,
      displayName: technician.display_name,
      firstName: technician.first_name,
      lastName: technician.last_name,
      email: technician.email,
      phone: technician.phone,
      locationStatus: technician.location_status,
      skills: technician.skills ?? [],
      languages: technician.languages ?? [],
      notes: technician.notes,
      isActive: technician.is_active,
    }
  }, [technician])

  const fallbackEditValues = React.useMemo<TechFormValues>(() => ({
    id: technicianId ?? '',
    displayName: '',
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    locationStatus: 'in_office',
    skills: [],
    languages: [],
    notes: null,
    isActive: true,
  }), [technicianId])

  if (!technicianId) return null

  const certs = certsData?.items ?? []
  const locationStatusLabels: Record<string, string> = {
    in_office: t('fieldTechnicians.locationStatus.in_office', 'In office'),
    on_trip: t('fieldTechnicians.locationStatus.on_trip', 'On trip'),
    at_client: t('fieldTechnicians.locationStatus.at_client', 'At client site'),
    unavailable: t('fieldTechnicians.locationStatus.unavailable', 'Unavailable'),
  }
  const statusLabel = locationStatusLabels[technician?.location_status ?? 'in_office'] ?? technician?.location_status
  const statusColor = LOCATION_STATUS_COLORS[technician?.location_status ?? 'in_office'] ?? 'bg-gray-100 text-gray-600'

  const tabs = [
    { id: 'overview' as const, label: t('fieldTechnicians.detail.tabs.overview', 'Overview') },
    { id: 'certifications' as const, label: t('fieldTechnicians.detail.tabs.certifications', 'Certifications & Permissions') },
    { id: 'availability' as const, label: t('fieldTechnicians.detail.tabs.availability', 'Availability') },
    { id: 'edit' as const, label: t('fieldTechnicians.detail.tabs.edit', 'Edit profile') },
  ]

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/backend/field-technicians"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <span aria-hidden className="mr-1 text-base">←</span>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {technician?.display_name ?? t('fieldTechnicians.detail.loading', 'Loading…')}
                  </h1>
                  {technician && (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  )}
                  {technician && !technician.is_active && (
                    <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                      {t('fieldTechnicians.detail.inactive', 'Inactive')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('fieldTechnicians.detail.subtitle', 'Service Technician Card')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {technician?.staff_member_id && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/backend/staff/team-members/${technician.staff_member_id}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {t('fieldTechnicians.detail.viewStaffProfile', 'Staff profile')}
                  </Link>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: t('fieldTechnicians.detail.confirm.delete', 'Delete technician?'),
                    variant: 'destructive',
                  })
                  if (confirmed) deleteMutation.mutate(technicianId)
                }}
              >
                {t('fieldTechnicians.detail.actions.delete', 'Delete')}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <nav className="flex items-center gap-5 text-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative -mb-px border-b-2 px-0 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && technician && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left column */}
              <div className="space-y-4 lg:col-span-2">
                {/* Identity & Contact */}
                <div className="rounded-lg border bg-card p-4">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('fieldTechnicians.detail.section.contact', 'Contact & Identity')}
                  </h2>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {technician.email && (
                      <div>
                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                          {t('fieldTechnicians.form.fields.email.label', 'Email')}
                        </dt>
                        <dd className="mt-0.5 text-sm">
                          <a href={`mailto:${technician.email}`} className="text-primary hover:underline">
                            {technician.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {technician.phone && (
                      <div>
                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                          {t('fieldTechnicians.form.fields.phone.label', 'Phone')}
                        </dt>
                        <dd className="mt-0.5 text-sm">
                          <a href={`tel:${technician.phone}`} className="text-primary hover:underline">
                            {technician.phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    {technician.vehicle_label && (
                      <div>
                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                          {t('fieldTechnicians.detail.fields.vehicle', 'Default vehicle')}
                        </dt>
                        <dd className="mt-0.5 text-sm">{technician.vehicle_label}</dd>
                      </div>
                    )}
                    {technician.current_order_id && (
                      <div>
                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                          {t('fieldTechnicians.detail.fields.currentOrder', 'Current assignment')}
                        </dt>
                        <dd className="mt-0.5 text-sm">
                          <span className="font-mono text-xs">{technician.current_order_id}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Notes */}
                {technician.notes && (
                  <div className="rounded-lg border bg-card p-4">
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('fieldTechnicians.detail.section.notes', 'Notes')}
                    </h2>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{technician.notes}</p>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Skills */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('fieldTechnicians.detail.section.skills', 'Skills & Specializations')}
                    </h2>
                  </div>
                  {technician.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {technician.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center rounded-full border bg-accent/30 px-2.5 py-1 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('fieldTechnicians.detail.skills.empty', 'No skills specified.')}
                    </p>
                  )}
                </div>

                {/* Languages */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('fieldTechnicians.detail.section.languages', 'Languages')}
                    </h2>
                  </div>
                  {technician.languages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {technician.languages.map((lang) => (
                        <span
                          key={lang}
                          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('fieldTechnicians.detail.languages.empty', 'No languages specified.')}
                    </p>
                  )}
                </div>

                {/* Location status */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('fieldTechnicians.detail.section.location', 'Current location')}
                    </h2>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Quick links */}
                {technician.staff_member_id && (
                  <div className="rounded-lg border bg-card p-4">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('fieldTechnicians.detail.section.links', 'Linked modules')}
                    </h2>
                    <div className="space-y-2">
                      <Link
                        href={`/backend/staff/team-members/${technician.staff_member_id}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('fieldTechnicians.detail.links.staffProfile', 'Staff member profile')}
                      </Link>
                      <Link
                        href={`/backend/staff/team-members/${technician.staff_member_id}?panel=availability`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('fieldTechnicians.detail.links.availability', 'Availability calendar')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certifications tab */}
          {activeTab === 'certifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  {t('fieldTechnicians.detail.certs.heading', 'Certifications & Permissions')}
                </h2>
                <Button size="sm" onClick={() => setShowAddCert(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t('fieldTechnicians.detail.certs.add', 'Add certification')}
                </Button>
              </div>

              {/* Add certification form */}
              {showAddCert && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="mb-4 text-sm font-semibold">
                    {t('fieldTechnicians.cert.form.title', 'New certification')}
                  </h3>
                  <CrudForm
                    embedded
                    title={t('fieldTechnicians.cert.form.title', 'New certification')}
                    entityId="field_technicians:field_technician_certification"
                    fields={certFields}
                    groups={certGroups}
                    submitLabel={t('fieldTechnicians.cert.form.submit', 'Add certification')}
                    cancelHref="#"
                    onSubmit={async (vals) => {
                      await createCrud('field-technicians/certifications', {
                        ...vals,
                        technicianId: technicianId,
                      })
                      flash(t('fieldTechnicians.detail.flash.certAdded', 'Certification added.'), 'success')
                      setShowAddCert(false)
                      refetchCerts()
                    }}
                  />
                </div>
              )}

              {/* Certifications list */}
              {certs.length === 0 && !showAddCert ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('fieldTechnicians.detail.certs.empty', 'No certifications added yet.')}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddCert(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('fieldTechnicians.detail.certs.add', 'Add certification')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {certs.map((cert) => {
                    const expired = isExpired(cert.expires_at)
                    const expiringSoon = isExpiringSoon(cert.expires_at)
                    return (
                      <div
                        key={cert.id}
                        className={`rounded-lg border p-4 ${expired ? 'border-destructive/40 bg-destructive/5' : expiringSoon ? 'border-amber-400/50 bg-amber-50/50' : 'bg-card'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{cert.name}</span>
                              {cert.cert_type && (
                                <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground uppercase">
                                  {cert.cert_type}
                                </span>
                              )}
                              {expired && (
                                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t('fieldTechnicians.cert.status.expired', 'Expired')}
                                </span>
                              )}
                              {!expired && expiringSoon && (
                                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t('fieldTechnicians.cert.status.expiringSoon', 'Expiring soon')}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {cert.code && (
                                <span>
                                  {t('fieldTechnicians.cert.field.code', 'Nr')}: <span className="font-mono">{cert.code}</span>
                                </span>
                              )}
                              {cert.issued_at && (
                                <span>
                                  {t('fieldTechnicians.cert.field.issuedAt', 'Issued')}: {formatDate(cert.issued_at, t)}
                                </span>
                              )}
                              {cert.expires_at && (
                                <span className={expired ? 'text-destructive' : expiringSoon ? 'text-amber-700' : ''}>
                                  {t('fieldTechnicians.cert.field.expiresAt', 'Expires')}: {formatDate(cert.expires_at, t)}
                                </span>
                              )}
                              {cert.issued_by && (
                                <span>
                                  {t('fieldTechnicians.cert.field.issuedBy', 'Issued by')}: {cert.issued_by}
                                </span>
                              )}
                            </div>
                            {cert.notes && (
                              <p className="text-xs text-muted-foreground">{cert.notes}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: t('fieldTechnicians.cert.confirm.delete', 'Remove certification?'),
                                variant: 'destructive',
                              })
                              if (confirmed) deleteCertMutation.mutate(cert.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Availability tab */}
          {activeTab === 'availability' && (
            <div className="space-y-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {t('fieldTechnicians.availability.heading', 'Availability Calendar')}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
                      else setCalendarMonth(m => m - 1)
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[140px] text-center text-sm font-medium">
                    {new Date(calendarYear, calendarMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
                      else setCalendarMonth(m => m + 1)
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs">
                {(Object.entries(DAY_TYPE_COLORS) as [AvailabilityDayType, string][]).map(([type, cls]) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
                    {t(DAY_TYPE_LABELS_KEY[type], type)}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm border bg-background" />
                  {t('fieldTechnicians.availability.dayType.none', 'No marking')}
                </span>
              </div>

              {/* Calendar grid */}
              <div className="rounded-lg border bg-card p-4">
                {/* Weekday headers */}
                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {[
                    t('fieldTechnicians.availability.weekday.mon', 'Mon'),
                    t('fieldTechnicians.availability.weekday.tue', 'Tue'),
                    t('fieldTechnicians.availability.weekday.wed', 'Wed'),
                    t('fieldTechnicians.availability.weekday.thu', 'Thu'),
                    t('fieldTechnicians.availability.weekday.fri', 'Fri'),
                    t('fieldTechnicians.availability.weekday.sat', 'Sat'),
                    t('fieldTechnicians.availability.weekday.sun', 'Sun'),
                  ].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                {(() => {
                  const firstOfMonth = new Date(calendarYear, calendarMonth, 1)
                  // JS getDay(): 0=Sun, 1=Mon … 6=Sat — convert to Mon-first offset
                  const startOffset = (firstOfMonth.getDay() + 6) % 7
                  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
                  const cells: React.ReactNode[] = []

                  for (let i = 0; i < startOffset; i++) {
                    cells.push(<div key={`empty-${i}`} />)
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const record = availabilityByDate[dateStr]
                    const dayType = record?.day_type ?? null
                    const colorCls = dayType ? DAY_TYPE_COLORS[dayType] : 'bg-muted/30 hover:bg-muted/60 text-foreground'
                    const isSaving = savingDate === dateStr
                    const today = new Date()
                    const isToday = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth && today.getDate() === day

                    cells.push(
                      <button
                        key={dateStr}
                        type="button"
                        disabled={isSaving}
                        title={dayType ? t(DAY_TYPE_LABELS_KEY[dayType], dayType) : t('fieldTechnicians.availability.dayType.none', 'No marking')}
                        className={`relative flex aspect-square items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${colorCls} ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        onClick={async () => {
                          setSavingDate(dateStr)
                          try {
                            const currentIndex = DAY_TYPE_CYCLE.indexOf(dayType)
                            const nextType = DAY_TYPE_CYCLE[(currentIndex + 1) % DAY_TYPE_CYCLE.length]
                            if (nextType === null) {
                              if (record) {
                                await deleteCrud('field-technicians/availability', record.id)
                              }
                            } else if (record) {
                              await updateCrud('field-technicians/availability', { id: record.id, dayType: nextType })
                            } else {
                              await createCrud('field-technicians/availability', {
                                technicianId,
                                date: dateStr,
                                dayType: nextType,
                              })
                            }
                            refetchAvailability()
                          } finally {
                            setSavingDate(null)
                          }
                        }}
                      >
                        {day}
                      </button>
                    )
                  }

                  return <div className="grid grid-cols-7 gap-1">{cells}</div>
                })()}
              </div>

              <p className="text-xs text-muted-foreground">
                {t('fieldTechnicians.availability.hint', 'Click a day to cycle through: work day → trip → unavailable → holiday → clear')}
              </p>
            </div>
          )}

          {/* Edit tab */}
          {activeTab === 'edit' && (
            <CrudForm<TechFormValues>
              title={t('fieldTechnicians.detail.edit.title', 'Edit profile')}
              backHref="/backend/field-technicians"
              entityId="field_technicians:field_technician"
              fields={editFields}
              groups={editGroups}
              initialValues={initialEditValues ?? fallbackEditValues}
              isLoading={!technician}
              loadingMessage={t('fieldTechnicians.form.loading', 'Loading technician profile…')}
              submitLabel={t('fieldTechnicians.form.edit.submit', 'Save changes')}
              cancelHref="/backend/field-technicians"
              onSubmit={async (vals) => {
                await updateCrud('field-technicians', vals)
                flash(t('fieldTechnicians.detail.flash.updated', 'Profile updated.'), 'success')
                queryClient.invalidateQueries({ queryKey: ['field-technician', technicianId] })
                setActiveTab('overview')
              }}
              onDelete={async () => {
                const confirmed = await confirm({
                  title: t('fieldTechnicians.detail.confirm.delete', 'Delete technician?'),
                  variant: 'destructive',
                })
                if (confirmed) {
                  await deleteCrud('field-technicians', technicianId)
                  pushWithFlash(router, '/backend/field-technicians', t('fieldTechnicians.detail.flash.deleted', 'Technician deleted.'), 'success')
                }
              }}
            />
          )}
        </div>
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
