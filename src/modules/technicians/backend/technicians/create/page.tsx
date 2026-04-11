"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader, FormFooter } from '@open-mercato/ui/backend/forms'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import StaffMemberSelect from '../../../components/StaffMemberSelect'
import SkillsInput from '../../../components/SkillsInput'

export default function CreateTechnicianPage() {
  const t = useT()
  const router = useRouter()
  const [staffMemberId, setStaffMemberId] = React.useState('')
  const [isActive, setIsActive] = React.useState('true')
  const [notes, setNotes] = React.useState('')
  const [skills, setSkills] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffMemberId) {
      setError(t('technicians.form.error.staffRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await apiCall<{ id: string }>('/api/technicians/technicians', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          staff_member_id: staffMemberId,
          is_active: isActive === 'true',
          notes: notes || undefined,
          skills: skills.length > 0 ? skills : undefined,
        }),
      })
      flash(t('technicians.form.flash.created'), 'success')
      router.push(`/backend/technicians/${res.id}/edit`)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('technicians.form.error.create')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormHeader mode="edit" title={t('technicians.form.create.title')} backHref="/backend/technicians" />

          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-6 mt-6">
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-medium">{t('technicians.form.groups.profile')}</h3>

              <StaffMemberSelect
                value={staffMemberId}
                label={t('technicians.form.fields.staffMemberId.label')}
                placeholder={t('technicians.form.fields.staffMemberId.placeholder')}
                onChange={setStaffMemberId}
              />

              <div className="space-y-1.5">
                <Label>{t('technicians.form.fields.isActive.label')}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={isActive}
                  onChange={(e) => setIsActive(e.target.value)}
                >
                  <option value="true">{t('technicians.enum.status.active')}</option>
                  <option value="false">{t('technicians.enum.status.inactive')}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('technicians.form.fields.notes.label')}</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  placeholder={t('technicians.form.fields.notes.placeholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <SkillsInput
                value={skills}
                label={t('technicians.form.groups.skills')}
                placeholder={t('technicians.skills.placeholder')}
                onChange={setSkills}
              />
            </div>
          </div>

          <FormFooter
            cancelHref="/backend/technicians"
            submitLabel={t('technicians.form.create.submit')}
            isSubmitting={submitting}
          />
        </form>
      </PageBody>
    </Page>
  )
}
