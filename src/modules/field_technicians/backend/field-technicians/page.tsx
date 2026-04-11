"use client"

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TechnicianRow = {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  location_status: string
  skills: string[]
  languages: string[]
  is_active: boolean
}

type TechniciansResponse = {
  items: TechnicianRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const LOCATION_STATUS_COLORS: Record<string, string> = {
  in_office: 'bg-green-100 text-green-800',
  on_trip: 'bg-blue-100 text-blue-800',
  at_client: 'bg-yellow-100 text-yellow-800',
  unavailable: 'bg-gray-100 text-gray-600',
}

function LocationBadge({ status }: { status: string }) {
  const t = useT()
  const labels: Record<string, string> = {
    in_office: t('fieldTechnicians.locationStatus.in_office', 'In office'),
    on_trip: t('fieldTechnicians.locationStatus.on_trip', 'On trip'),
    at_client: t('fieldTechnicians.locationStatus.at_client', 'At client site'),
    unavailable: t('fieldTechnicians.locationStatus.unavailable', 'Unavailable'),
  }
  const label = labels[status] ?? status
  const color = LOCATION_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function SkillTags({ skills }: { skills: string[] }) {
  if (!skills.length) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {skills.slice(0, 3).map((skill) => (
        <span key={skill} className="inline-flex items-center rounded-full border bg-accent/20 px-2 py-0.5 text-xs">
          {skill}
        </span>
      ))}
      {skills.length > 3 && (
        <span className="text-xs text-muted-foreground">+{skills.length - 3}</span>
      )}
    </span>
  )
}

function buildColumns(t: (k: string, fb?: string) => string): ColumnDef<TechnicianRow>[] {
  return [
    {
      accessorKey: 'first_name',
      header: t('fieldTechnicians.table.column.firstName', 'First name'),
      meta: { priority: 1 },
      cell: ({ getValue }) => {
        const val = getValue()
        return val ? <span>{String(val)}</span> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'last_name',
      header: t('fieldTechnicians.table.column.lastName', 'Last name'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const val = getValue()
        return val ? <span>{String(val)}</span> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'location_status',
      header: t('fieldTechnicians.table.column.locationStatus', 'Location'),
      meta: { priority: 3 },
      cell: ({ getValue }) => <LocationBadge status={String(getValue() ?? 'in_office')} />,
    },
    {
      accessorKey: 'email',
      header: t('fieldTechnicians.table.column.email', 'Email'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const val = getValue()
        return val ? <span className="text-sm">{String(val)}</span> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'skills',
      header: t('fieldTechnicians.table.column.skills', 'Skills'),
      meta: { priority: 5 },
      enableSorting: false,
      cell: ({ getValue }) => <SkillTags skills={Array.isArray(getValue()) ? getValue() as string[] : []} />,
    },
    {
      accessorKey: 'is_active',
      header: t('fieldTechnicians.table.column.active', 'Active'),
      meta: { priority: 6 },
      cell: ({ getValue }) => <BooleanIcon value={!!getValue()} />,
    },
  ]
}

export default function FieldTechniciansPage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'last_name', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const columns = React.useMemo(() => buildColumns(t), [t])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id ?? 'last_name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (search) params.set('search', search)
    if (filterValues.location_status) params.set('locationStatus', String(filterValues.location_status))
    if (filterValues.is_active !== undefined) params.set('isActive', String(filterValues.is_active))
    return params.toString()
  }, [page, sorting, search, filterValues])

  const { data, isLoading } = useQuery<TechniciansResponse>({
    queryKey: ['field-technicians', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<TechnicianRow>('field-technicians', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleDelete = React.useCallback(async (row: TechnicianRow) => {
    const confirmed = await confirm({
      title: t('fieldTechnicians.table.confirm.delete', 'Delete technician?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteCrud('field-technicians', row.id)
      flash(t('fieldTechnicians.table.flash.deleted', 'Technician deleted.'), 'success')
      queryClient.invalidateQueries({ queryKey: ['field-technicians'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('fieldTechnicians.table.error.delete', 'Failed to delete.')
      flash(message, 'error')
    }
  }, [confirm, queryClient, t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('fieldTechnicians.table.title', 'Technicians')}
          actions={
            <Button asChild>
              <Link href="/backend/field-technicians/create">
                {t('fieldTechnicians.table.actions.create', 'Add technician')}
              </Link>
            </Button>
          }
          columns={columns}
          data={data?.items ?? []}
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchAlign="right"
          filters={[
            {
              id: 'location_status',
              label: t('fieldTechnicians.table.filters.locationStatus', 'Location'),
              type: 'select',
              options: [
                { value: 'in_office', label: t('fieldTechnicians.locationStatus.in_office', 'In office') },
                { value: 'on_trip', label: t('fieldTechnicians.locationStatus.on_trip', 'On trip') },
                { value: 'at_client', label: t('fieldTechnicians.locationStatus.at_client', 'At client site') },
                { value: 'unavailable', label: t('fieldTechnicians.locationStatus.unavailable', 'Unavailable') },
              ],
            },
            {
              id: 'is_active',
              label: t('fieldTechnicians.table.filters.active', 'Active only'),
              type: 'checkbox',
            },
          ]}
          filterValues={filterValues}
          onFiltersApply={(vals) => { setFilterValues(vals); setPage(1) }}
          onFiltersClear={() => { setFilterValues({}); setSearch(''); setPage(1) }}
          entityId="field_technicians:field_technician"
          sortable
          sorting={sorting}
          onSortingChange={(s) => { setSorting(s); setPage(1) }}
          perspective={{ tableId: 'field_technicians.list' }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('fieldTechnicians.table.actions.view', 'View card'),
                  href: `/backend/field-technicians/${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('fieldTechnicians.table.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          pagination={{
            page,
            pageSize: 50,
            total: data?.total ?? 0,
            totalPages: data?.totalPages ?? 0,
            onPageChange: setPage,
          }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/backend/field-technicians/${row.id}`)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
