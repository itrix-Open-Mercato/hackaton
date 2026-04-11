"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Check, X } from 'lucide-react'
import type { InjectionWidgetModule, InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'
import type { TechnicianListItem } from '../../../types'

type TechniciansResponse = {
  items: TechnicianListItem[]
  total: number
}

function TechnicianPickerWidget({ data, onDataChange, disabled }: InjectionWidgetComponentProps) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [search, setSearch] = React.useState('')

  const formValues = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

  const selectedIds = React.useMemo<string[]>(() => {
    const raw = formValues.staff_member_ids
    if (Array.isArray(raw)) return raw as string[]
    return []
  }, [formValues.staff_member_ids])

  const { data: techData } = useQuery<TechniciansResponse>({
    queryKey: ['technicians-picker', search, scopeVersion],
    queryFn: () => fetchCrudList<TechnicianListItem>('technicians/technicians', {
      is_active: 'true',
      pageSize: 50,
    }),
  })

  const { data: selectedTechData } = useQuery<TechniciansResponse>({
    queryKey: ['technicians-picker-selected', selectedIds.join(','), scopeVersion],
    queryFn: () => fetchCrudList<TechnicianListItem>('technicians/technicians', {
      staff_member_ids: selectedIds.join(','),
      pageSize: Math.max(selectedIds.length, 1),
    }),
    enabled: selectedIds.length > 0,
  })

  const technicians = React.useMemo(() => {
    const merged = new Map<string, TechnicianListItem>()

    for (const tech of selectedTechData?.items ?? []) {
      merged.set(tech.staffMemberId, tech)
    }

    for (const tech of techData?.items ?? []) {
      merged.set(tech.staffMemberId, tech)
    }

    return [...merged.values()]
  }, [selectedTechData?.items, techData?.items])

  const filteredTechnicians = React.useMemo(() => {
    if (!search.trim()) return technicians
    const term = search.toLowerCase()
    return technicians.filter(
      (tech) =>
        (tech.staffMemberName ?? tech.staffMemberId).toLowerCase().includes(term) ||
        tech.skills.some((s) => s.toLowerCase().includes(term)),
    )
  }, [technicians, search])

  const toggleTechnician = (staffMemberId: string) => {
    const next = selectedIds.includes(staffMemberId)
      ? selectedIds.filter((id) => id !== staffMemberId)
      : [...selectedIds, staffMemberId]
    onDataChange?.({ ...formValues, staff_member_ids: next } as typeof data)
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{t('technicians.picker.title')}</h3>

      {selectedIds.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">{t('technicians.picker.noneSelected')}</p>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const tech = technicians.find((t) => t.staffMemberId === id)
            const label = tech?.staffMemberName
              ?? (tech?.skills?.length ? tech.skills.join(', ') : `Technician ${id.slice(0, 8)}`)
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                {label}
                <button type="button" className="ml-1 hover:text-destructive" onClick={() => toggleTechnician(id)} disabled={disabled}>
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <input
        type="text"
        className="mb-2 w-full rounded-md border px-3 py-1.5 text-sm"
        placeholder={t('technicians.picker.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />

      <div className="max-h-48 overflow-y-auto">
        {filteredTechnicians.map((tech) => {
          const isSelected = selectedIds.includes(tech.staffMemberId)
          return (
            <button
              key={tech.id}
              type="button"
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted ${
                isSelected ? 'bg-blue-50' : ''
              }`}
              onClick={() => toggleTechnician(tech.staffMemberId)}
              disabled={disabled}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {tech.staffMemberName ?? `Technician ${tech.staffMemberId.slice(0, 8)}`}
                </span>
                {tech.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tech.skills.map((skill) => (
                      <span key={skill} className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                {tech.certifications && tech.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tech.certifications.map((cert) => (
                      <span key={cert.id} className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${cert.isExpired ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}`}>
                        {cert.name}
                      </span>
                    ))}
                  </div>
                )}
                {tech.isActive && (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                    Active
                  </span>
                )}
              </div>
              {isSelected && <Check size={14} className="text-blue-600" />}
            </button>
          )
        })}
        {filteredTechnicians.length === 0 && (
          <div className="py-3 text-center text-sm text-muted-foreground">{t('technicians.picker.empty')}</div>
        )}
      </div>
    </div>
  )
}

const widget: InjectionWidgetModule<unknown, unknown> = {
  metadata: {
    id: 'technicians.injection.TechnicianPicker',
    title: 'Technician Picker',
    description: 'Select technicians for service tickets',
    priority: 20,
    enabled: true,
  },
  Widget: TechnicianPickerWidget,
}

export default widget
