"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge, type EnumBadgeMap } from '@open-mercato/ui/backend/ValueIcons'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { deleteCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { Button } from '@open-mercato/ui/primitives/button'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { TechnicianListItem } from '../types'

type TechniciansResponse = {
  items: TechnicianListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function buildStatusMap(t: (key: string) => string): EnumBadgeMap {
  return {
    true: { label: t('technicians.enum.status.active'), className: 'border-green-200 text-green-700 bg-green-50' },
    false: { label: t('technicians.enum.status.inactive'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
  }
}

function buildColumns(t: (key: string) => string): ColumnDef<TechnicianListItem>[] {
  const statusMap = buildStatusMap(t)

  return [
    {
      accessorKey: 'staffMemberName',
      header: t('technicians.table.column.staffMemberId'),
      meta: { priority: 1 },
      cell: ({ row }) => {
        const name = row.original.staffMemberName
        return name || <span className="text-muted-foreground">{row.original.staffMemberId.slice(0, 12)}...</span>
      },
    },
    {
      accessorKey: 'isActive',
      header: t('technicians.table.column.status'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={statusMap} />,
    },
    {
      accessorKey: 'skills',
      header: t('technicians.table.column.skills'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const skills = getValue() as string[]
        if (!skills.length) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{s}</span>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'certificationCount',
      header: t('technicians.table.column.certifications'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const count = getValue() as number
        return count > 0 ? count : <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('technicians.table.column.createdAt'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">—</span>
        return new Date(value).toLocaleDateString()
      },
    },
  ]
}

export default function TechniciansTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'createdAt',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })

    Object.entries(values).forEach(([key, value]) => {
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return
      if (Array.isArray(value)) {
        params.set(key, value.map(String).join(','))
      } else {
        params.set(key, String(value))
      }
    })

    return params.toString()
  }, [page, sorting, values])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data: techData, isLoading, error } = useQuery<TechniciansResponse>({
    queryKey: ['technicians', queryParams, scopeVersion],
    queryFn: async () =>
      fetchCrudList<TechnicianListItem>('technicians/technicians', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  const handleReset = () => {
    setValues({})
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('technicians.table.error.generic')}</div>
  }

  return (
    <>
      <DataTable
        title={t('technicians.table.title')}
        actions={(
          <Button asChild>
            <Link href="/backend/technicians/create">{t('technicians.table.actions.create')}</Link>
          </Button>
        )}
        columns={columns}
        data={techData?.items ?? []}
        filters={[
          {
            id: 'is_active',
            label: t('technicians.table.filters.status'),
            type: 'select',
            options: [
              { value: 'true', label: t('technicians.enum.status.active') },
              { value: 'false', label: t('technicians.enum.status.inactive') },
            ],
          },
        ]}
        filterValues={values}
        onFiltersApply={(nextValues: FilterValues) => {
          setValues(nextValues)
          setPage(1)
        }}
        onFiltersClear={handleReset}
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        rowActions={(row) => (
          <RowActions
            items={[
              { id: 'edit', label: t('technicians.table.actions.edit'), href: `/backend/technicians/${row.id}/edit` },
              {
                id: 'delete',
                label: t('technicians.table.actions.delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('technicians.table.confirm.delete'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return

                  try {
                    await deleteCrud('technicians/technicians', row.id)
                    flash(t('technicians.form.flash.deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['technicians'] })
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : t('technicians.table.error.delete')
                    flash(message, 'error')
                  }
                },
              },
            ]}
          />
        )}
        pagination={{
          page,
          pageSize: 50,
          total: techData?.total || 0,
          totalPages: techData?.totalPages || 0,
          onPageChange: setPage,
        }}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/backend/technicians/${row.id}`)}
      />
      {ConfirmDialogElement}
    </>
  )
}
