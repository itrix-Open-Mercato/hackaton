"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Check, X } from 'lucide-react'
import type { TechnicianListItem } from '../../../types'

type TechniciansResponse = {
  items: TechnicianListItem[]
  total: number
}

type TechnicianPickerProps = {
  values: Record<string, unknown>
  setValue: (field: string, value: unknown) => void
}

export default function TechnicianPicker({ values, setValue }: TechnicianPickerProps) {
  const t = useT()
  const [search, setSearch] = React.useState('')

  const selectedIds = React.useMemo<string[]>(() => {
    const raw = values.staff_member_ids
    if (Array.isArray(raw)) return raw as string[]
    return []
  }, [values.staff_member_ids])

  const { data: techData } = useQuery<TechniciansResponse>({
    queryKey: ['technicians-picker', search],
    queryFn: () => fetchCrudList<TechnicianListItem>('technicians/technicians', {
      is_active: 'true',
      pageSize: 50,
    }),
  })

  const technicians = techData?.items ?? []

  const filteredTechnicians = React.useMemo(() => {
    if (!search.trim()) return technicians
    const term = search.toLowerCase()
    return technicians.filter(
      (tech) =>
        tech.staffMemberId.toLowerCase().includes(term) ||
        tech.skills.some((s) => s.toLowerCase().includes(term)),
    )
  }, [technicians, search])

  const toggleTechnician = (staffMemberId: string) => {
    const next = selectedIds.includes(staffMemberId)
      ? selectedIds.filter((id) => id !== staffMemberId)
      : [...selectedIds, staffMemberId]
    setValue('staff_member_ids', next)
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{t('technicians.picker.title')}</h3>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const tech = technicians.find((t) => t.staffMemberId === id)
            const label = tech?.skills?.length
              ? `Technician (${tech.skills.join(', ')})`
              : `Technician ${id.slice(0, 8)}`
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                {label}
                <button type="button" className="ml-1 hover:text-destructive" onClick={() => toggleTechnician(id)}>
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
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {tech.skills.length > 0
                    ? tech.skills.join(', ')
                    : `Technician ${tech.staffMemberId.slice(0, 8)}`}
                </span>
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

export const widgetConfig = {
  slot: 'crud-form:service_tickets:service_ticket',
}
