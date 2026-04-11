"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { Label } from '@open-mercato/ui/primitives/label'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

type StaffMember = {
  id: string
  displayName: string
  isActive: boolean
}

type StaffMemberSelectProps = {
  value: string
  label: string
  placeholder: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export default function StaffMemberSelect({
  value,
  label,
  placeholder,
  error,
  disabled,
  onChange,
}: StaffMemberSelectProps) {
  const scopeVersion = useOrganizationScopeVersion()

  const { data } = useQuery<{ items: StaffMember[] }>({
    queryKey: ['staff-members-for-technician', scopeVersion],
    queryFn: () => fetchCrudList<StaffMember>('staff/team-members', { pageSize: 100, is_active: 'true' }),
  })

  const members = data?.items ?? []

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
