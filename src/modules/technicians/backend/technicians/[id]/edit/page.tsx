"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { deleteCrud, fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { FormHeader, FormFooter } from '@open-mercato/ui/backend/forms'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { X, Plus, Award } from 'lucide-react'
import StaffMemberSelect from '../../../../components/StaffMemberSelect'
import type { TechnicianListItem, TechnicianSkillItem, TechnicianCertificationItem } from '../../../../types'

async function apiFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json()
}

function SkillsSection({ technicianId, initialSkills, onRefresh }: { technicianId: string; initialSkills: TechnicianSkillItem[]; onRefresh: () => void }) {
  const t = useT()
  const [skills, setSkills] = React.useState<TechnicianSkillItem[]>(initialSkills)
  const [newSkill, setNewSkill] = React.useState('')

  React.useEffect(() => { setSkills(initialSkills) }, [initialSkills])

  const addSkill = async (name: string) => {
    try {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/skills`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setNewSkill('')
      onRefresh()
    } catch (err: any) {
      flash(err.message || t('technicians.skills.error.add'), 'error')
    }
  }

  const removeSkill = async (skillId: string) => {
    try {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/skills?id=${skillId}`, { method: 'DELETE' })
      onRefresh()
    } catch (err: any) {
      flash(err.message || t('technicians.skills.error.remove'), 'error')
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{t('technicians.form.groups.skills')}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
            {s.name}
            <button type="button" className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => removeSkill(s.id)}>
              <X size={14} />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-sm text-muted-foreground">{t('technicians.skills.empty')}</span>}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newSkill.trim()) addSkill(newSkill.trim()) }}>
        <input type="text" className="flex-1 rounded-md border px-3 py-1.5 text-sm" placeholder={t('technicians.skills.placeholder')} value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
        <Button type="submit" variant="outline" size="sm" disabled={!newSkill.trim()}>
          <Plus size={14} className="mr-1" />{t('technicians.skills.add')}
        </Button>
      </form>
    </div>
  )
}

function CertificationsSection({ technicianId, initialCerts, onRefresh }: { technicianId: string; initialCerts: TechnicianCertificationItem[]; onRefresh: () => void }) {
  const t = useT()
  const [certs, setCerts] = React.useState<TechnicianCertificationItem[]>(initialCerts)
  const [adding, setAdding] = React.useState(false)
  const [newCert, setNewCert] = React.useState({ name: '', certificate_number: '', issued_at: '', expires_at: '' })

  React.useEffect(() => { setCerts(initialCerts) }, [initialCerts])

  const addCert = async () => {
    try {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/certifications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newCert),
      })
      setNewCert({ name: '', certificate_number: '', issued_at: '', expires_at: '' })
      setAdding(false)
      onRefresh()
    } catch (err: any) {
      flash(err.message || t('technicians.certifications.error.add'), 'error')
    }
  }

  const removeCert = async (certId: string) => {
    try {
      await apiFetchJson(`/api/technicians/technicians/${technicianId}/certifications?id=${certId}`, { method: 'DELETE' })
      onRefresh()
    } catch (err: any) {
      flash(err.message || t('technicians.certifications.error.remove'), 'error')
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('technicians.form.groups.certifications')}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} className="mr-1" />{t('technicians.certifications.add')}
        </Button>
      </div>
      {certs.length === 0 && !adding && <span className="text-sm text-muted-foreground">{t('technicians.certifications.empty')}</span>}
      <div className="space-y-2">
        {certs.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Award size={14} className={c.isExpired ? 'text-red-500' : 'text-green-500'} />
              <span className="font-medium">{c.name}</span>
              {c.certificateNumber && <span className="text-muted-foreground">#{c.certificateNumber}</span>}
              {c.expiresAt && (
                <span className={c.isExpired ? 'text-red-500' : 'text-muted-foreground'}>
                  {c.isExpired ? t('technicians.certifications.expired') : t('technicians.certifications.expires')} {new Date(c.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeCert(c.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {adding && (
          <form className="space-y-2 rounded border p-3" onSubmit={(e) => { e.preventDefault(); if (newCert.name.trim()) addCert() }}>
            <input type="text" className="w-full rounded-md border px-3 py-1.5 text-sm" placeholder={t('technicians.certifications.namePlaceholder')} value={newCert.name} onChange={(e) => setNewCert((p) => ({ ...p, name: e.target.value }))} required />
            <input type="text" className="w-full rounded-md border px-3 py-1.5 text-sm" placeholder={t('technicians.certifications.numberPlaceholder')} value={newCert.certificate_number} onChange={(e) => setNewCert((p) => ({ ...p, certificate_number: e.target.value }))} />
            <div className="flex gap-2">
              <input type="date" className="flex-1 rounded-md border px-3 py-1.5 text-sm" value={newCert.issued_at} onChange={(e) => setNewCert((p) => ({ ...p, issued_at: e.target.value }))} />
              <input type="date" className="flex-1 rounded-md border px-3 py-1.5 text-sm" value={newCert.expires_at} onChange={(e) => setNewCert((p) => ({ ...p, expires_at: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!newCert.name.trim()}>{t('technicians.certifications.save')}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>{t('technicians.certifications.cancel')}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function EditTechnicianPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: techData, isLoading, refetch } = useQuery({
    queryKey: ['technician-detail', id],
    queryFn: () => fetchCrudList<TechnicianListItem>('technicians/technicians', { id: String(id), pageSize: 1 }),
    enabled: !!id,
  })

  const item = techData?.items?.[0] ?? null

  const [isActive, setIsActive] = React.useState('true')
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (item) {
      setIsActive(String(item.isActive ?? true))
      setNotes(item.notes ?? '')
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmitting(true)
    setErr(null)
    try {
      await updateCrud('technicians/technicians', { id, is_active: isActive === 'true', notes: notes || null })
      flash(t('technicians.form.flash.saved'), 'success')
      refetch()
    } catch (error: any) {
      setErr(error.message || t('technicians.form.error.load'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await deleteCrud('technicians/technicians', String(id))
      pushWithFlash(router, '/backend/technicians', t('technicians.form.flash.deleted'), 'success')
    } catch (error: any) {
      setErr(error.message || t('technicians.table.error.delete'))
    }
  }

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t('technicians.form.loading')}</div>
        ) : !item ? (
          <ErrorMessage label={t('technicians.form.error.notFound')} />
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleSubmit}>
              <FormHeader mode="edit" title={t('technicians.form.edit.title')} backHref="/backend/technicians" />

              <div className="space-y-6 mt-6">
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="text-sm font-medium">{t('technicians.form.groups.profile')}</h3>
                  <StaffMemberSelect
                    value={item.staffMemberId}
                    label={t('technicians.form.fields.staffMemberId.label')}
                    placeholder={t('technicians.form.fields.staffMemberId.placeholder')}
                    onChange={() => {}}
                    disabled
                  />
                  <div className="space-y-1.5">
                    <Label>{t('technicians.form.fields.isActive.label')}</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
                      <option value="true">{t('technicians.enum.status.active')}</option>
                      <option value="false">{t('technicians.enum.status.inactive')}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('technicians.form.fields.notes.label')}</Label>
                    <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm" placeholder={t('technicians.form.fields.notes.placeholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>

              <FormFooter actions={{ cancelHref: '/backend/technicians', submit: { label: t('technicians.form.edit.submit'), pending: submitting }, showDelete: true, onDelete: handleDelete }} />
            </form>

            <SkillsSection
              technicianId={id}
              initialSkills={item.skillItems ?? []}
              onRefresh={() => refetch()}
            />

            <CertificationsSection
              technicianId={id}
              initialCerts={item.certifications ?? []}
              onRefresh={() => refetch()}
            />
          </div>
        )}
      </PageBody>
    </Page>
  )
}
