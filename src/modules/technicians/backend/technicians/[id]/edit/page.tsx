"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { deleteCrud, fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { X, Plus, Award } from 'lucide-react'
import StaffMemberSelect from '../../../../components/StaffMemberSelect'
import {
  buildTechnicianFields,
  buildTechnicianGroups,
  createEmptyTechnicianFormValues,
  mapTechnicianToFormValues,
  type TechnicianFormValues,
} from '../../../../components/technicianFormConfig'
import type { TechnicianListItem, TechnicianSkillItem, TechnicianCertificationItem } from '../../../../types'

async function apiFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json()
}

function SkillsSection({ technicianId }: { technicianId: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [newSkill, setNewSkill] = React.useState('')

  const { data: skillsData } = useQuery<{ items: TechnicianSkillItem[] }>({
    queryKey: ['technician-skills', technicianId],
    queryFn: () => apiFetchJson(`/api/technicians/technicians/${technicianId}/skills`),
  })

  const addSkill = useMutation({
    mutationFn: async (name: string) => {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/skills`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-skills', technicianId] })
      setNewSkill('')
    },
    onError: (err: Error) => flash(err.message || t('technicians.skills.error.add'), 'error'),
  })

  const removeSkill = useMutation({
    mutationFn: async (skillId: string) => {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/skills?id=${skillId}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-skills', technicianId] })
    },
    onError: (err: Error) => flash(err.message || t('technicians.skills.error.remove'), 'error'),
  })

  const skills = skillsData?.items ?? []

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{t('technicians.form.groups.skills')}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
            {s.name}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-destructive"
              onClick={() => removeSkill.mutate(s.id)}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {skills.length === 0 && (
          <span className="text-sm text-muted-foreground">{t('technicians.skills.empty')}</span>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (newSkill.trim()) addSkill.mutate(newSkill.trim())
        }}
      >
        <input
          type="text"
          className="flex-1 rounded-md border px-3 py-1.5 text-sm"
          placeholder={t('technicians.skills.placeholder')}
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!newSkill.trim()}>
          <Plus size={14} className="mr-1" />
          {t('technicians.skills.add')}
        </Button>
      </form>
    </div>
  )
}

function CertificationsSection({ technicianId }: { technicianId: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [adding, setAdding] = React.useState(false)
  const [newCert, setNewCert] = React.useState({ name: '', certificate_number: '', issued_at: '', expires_at: '' })

  const { data: certsData } = useQuery<{ items: TechnicianCertificationItem[] }>({
    queryKey: ['technician-certs', technicianId],
    queryFn: () => apiFetchJson(`/api/technicians/technicians/${technicianId}/certifications`),
  })

  const addCert = useMutation({
    mutationFn: async (data: typeof newCert) => {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/certifications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-certs', technicianId] })
      setNewCert({ name: '', certificate_number: '', issued_at: '', expires_at: '' })
      setAdding(false)
    },
    onError: (err: Error) => flash(err.message || t('technicians.certifications.error.add'), 'error'),
  })

  const removeCert = useMutation({
    mutationFn: async (certId: string) => {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/certifications?id=${certId}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-certs', technicianId] })
    },
    onError: (err: Error) => flash(err.message || t('technicians.certifications.error.remove'), 'error'),
  })

  const certs = certsData?.items ?? []

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('technicians.form.groups.certifications')}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} className="mr-1" />
          {t('technicians.certifications.add')}
        </Button>
      </div>

      {certs.length === 0 && !adding && (
        <span className="text-sm text-muted-foreground">{t('technicians.certifications.empty')}</span>
      )}

      <div className="space-y-2">
        {certs.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Award size={14} className={c.isExpired ? 'text-red-500' : 'text-green-500'} />
              <span className="font-medium">{c.name}</span>
              {c.certificateNumber && <span className="text-muted-foreground">#{c.certificateNumber}</span>}
              {c.expiresAt && (
                <span className={c.isExpired ? 'text-red-500' : 'text-muted-foreground'}>
                  {c.isExpired ? t('technicians.certifications.expired') : t('technicians.certifications.expires')}
                  {' '}
                  {new Date(c.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => removeCert.mutate(c.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {adding && (
          <form
            className="space-y-2 rounded border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (newCert.name.trim()) addCert.mutate(newCert)
            }}
          >
            <input
              type="text"
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              placeholder={t('technicians.certifications.namePlaceholder')}
              value={newCert.name}
              onChange={(e) => setNewCert((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              type="text"
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              placeholder={t('technicians.certifications.numberPlaceholder')}
              value={newCert.certificate_number}
              onChange={(e) => setNewCert((prev) => ({ ...prev, certificate_number: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                value={newCert.issued_at}
                onChange={(e) => setNewCert((prev) => ({ ...prev, issued_at: e.target.value }))}
              />
              <input
                type="date"
                className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                value={newCert.expires_at}
                onChange={(e) => setNewCert((prev) => ({ ...prev, expires_at: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!newCert.name.trim()}>
                {t('technicians.certifications.save')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
                {t('technicians.certifications.cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function TicketHistorySection({ staffMemberId }: { staffMemberId: string }) {
  const t = useT()

  const { data: ticketsData } = useQuery<{ items: any[] }>({
    queryKey: ['technician-tickets', staffMemberId],
    queryFn: () => fetchCrudList<any>('service_tickets/tickets', { pageSize: 50, sortField: 'createdAt', sortDir: 'desc' }),
    enabled: !!staffMemberId,
  })

  // Filter by enrichment or show all (when enricher isn't active)
  const tickets = React.useMemo(() => {
    const items = ticketsData?.items ?? []
    const filtered = items.filter((ticket: any) => {
      const techAssignments = ticket._technicians?.assignments
      if (Array.isArray(techAssignments)) {
        return techAssignments.some((a: any) => a.staffMemberId === staffMemberId)
      }
      return false
    })
    return filtered
  }, [ticketsData, staffMemberId])

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{t('technicians.form.groups.ticketHistory')}</h3>
      {tickets.length === 0 ? (
        <span className="text-sm text-muted-foreground">{t('technicians.tickets.empty')}</span>
      ) : (
        <div className="space-y-1">
          {tickets.slice(0, 10).map((ticket: any) => (
            <a
              key={ticket.id}
              href={`/backend/service-tickets/${ticket.id}/edit`}
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="font-medium">{ticket.ticketNumber}</span>
              <span className="text-muted-foreground">{ticket.status}</span>
              {ticket.visitDate && (
                <span className="text-muted-foreground">{new Date(ticket.visitDate).toLocaleDateString()}</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EditTechnicianPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TechnicianFormValues | null>(null)
  const [staffMemberId, setStaffMemberId] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo(() => {
    const base = buildTechnicianFields(t)
    // Replace text field with hidden — we'll render StaffMemberSelect separately
    return base.map((f) =>
      f.id === 'staff_member_id' ? { ...f, type: 'hidden' as const } : f,
    )
  }, [t])
  const groups = React.useMemo(() => buildTechnicianGroups(t), [t])

  const successRedirect = React.useMemo(
    () => `/backend/technicians?flash=${encodeURIComponent(t('technicians.form.flash.saved'))}&type=success`,
    [t],
  )

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)

      try {
        const data = await fetchCrudList<TechnicianListItem>('technicians/technicians', { id: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error(t('technicians.form.error.notFound'))

        if (!cancelled) {
          setInitial(mapTechnicianToFormValues(item))
          setStaffMemberId(item.staffMemberId)
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : t('technicians.form.error.load')
          setErr(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallbackInitialValues = React.useMemo<TechnicianFormValues>(
    () => createEmptyTechnicianFormValues(id ?? ''),
    [id],
  )

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <ErrorMessage label={err} />
        ) : (
          <div className="space-y-6">
            {!loading && (
              <div className="rounded-lg border p-4 mb-2">
                <StaffMemberSelect
                  value={staffMemberId}
                  label={t('technicians.form.fields.staffMemberId.label')}
                  placeholder={t('technicians.form.fields.staffMemberId.placeholder')}
                  onChange={(val) => setStaffMemberId(val)}
                  disabled
                />
              </div>
            )}

            <CrudForm<TechnicianFormValues>
              title={t('technicians.form.edit.title')}
              backHref="/backend/technicians"
              fields={fields}
              groups={groups}
              initialValues={initial ?? fallbackInitialValues}
              submitLabel={t('technicians.form.edit.submit')}
              cancelHref="/backend/technicians"
              successRedirect={successRedirect}
              isLoading={loading}
              loadingMessage={t('technicians.form.loading')}
              onSubmit={async (values) => {
                await updateCrud('technicians/technicians', {
                  ...values,
                  is_active: values.is_active === 'true',
                })
              }}
              onDelete={async () => {
                if (!id) return
                try {
                  await deleteCrud('technicians/technicians', String(id))
                  pushWithFlash(router, '/backend/technicians', t('technicians.form.flash.deleted'), 'success')
                } catch (error) {
                  const message = error instanceof Error && error.message ? error.message : t('technicians.table.error.delete')
                  setErr(message)
                }
              }}
            />

            {!loading && (
              <>
                <SkillsSection technicianId={id} />
                <CertificationsSection technicianId={id} />
                <TicketHistorySection staffMemberId={staffMemberId} />
              </>
            )}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
