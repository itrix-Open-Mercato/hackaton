"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge, type EnumBadgeMap } from '@open-mercato/ui/backend/ValueIcons'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ProtocolListItem = {
  id: string
  protocolNumber: string
  serviceTicketId: string
  status: string
  type: string
  customerEntityId: string | null
  machineAssetId: string | null
  plannedVisitDateSnapshot: string | null
  workDescription: string | null
  isActive: boolean
  closedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

type ProtocolsResponse = {
  items: ProtocolListItem[]
  total: number
  page: number
  pageSize: number
  totalCount?: number
}

function buildStatusMap(t: (key: string) => string): EnumBadgeMap {
  return {
    draft: { label: t('service_protocols.enum.status.draft'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
    in_review: { label: t('service_protocols.enum.status.in_review'), className: 'border-yellow-200 text-yellow-800 bg-yellow-50' },
    approved: { label: t('service_protocols.enum.status.approved'), className: 'border-blue-200 text-blue-700 bg-blue-50' },
    closed: { label: t('service_protocols.enum.status.closed'), className: 'border-green-200 text-green-700 bg-green-50' },
    cancelled: { label: t('service_protocols.enum.status.cancelled'), className: 'border-red-200 text-red-700 bg-red-50' },
  }
}

function buildColumns(t: (key: string) => string): ColumnDef<ProtocolListItem>[] {
  const statusMap = buildStatusMap(t)
  return [
    { accessorKey: 'protocolNumber', header: t('service_protocols.table.column.protocolNumber'), meta: { priority: 1 } },
    { accessorKey: 'serviceTicketId', header: t('service_protocols.table.column.ticketId'), meta: { priority: 2 }, cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '').slice(0, 8)}…</span> },
    {
      accessorKey: 'status',
      header: t('service_protocols.table.column.status'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={statusMap} />,
    },
    {
      accessorKey: 'plannedVisitDateSnapshot',
      header: t('service_protocols.table.column.visitDate'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? <span>{new Date(v).toLocaleDateString()}</span> : <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'updatedAt',
      header: t('service_protocols.table.column.updatedAt'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? <span>{new Date(v).toLocaleDateString()}</span> : <span className="text-muted-foreground">—</span>
      },
    },
  ]
}

export default function ServiceProtocolsPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()

  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [filterValues, setFilterValues] = React.useState<Record<string, unknown>>({})

  const queryParams = React.useMemo(() => {
    const p: Record<string, unknown> = { page, pageSize: 50, sortField: 'updated_at', sortDir: 'desc' }
    if (search) p.search = search
    if (filterValues.status) p.status = filterValues.status
    return p
  }, [page, search, filterValues])

  const { data, isLoading, error } = useQuery<ProtocolsResponse>({
    queryKey: ['service_protocols', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<ProtocolListItem>('service_protocols/protocols', queryParams as Record<string, string>),
  })

  const columns = React.useMemo(() => buildColumns(t), [t])

  return (
    <Page>
      <PageBody>
        {error ? (
          <div className="text-sm text-destructive">{t('service_protocols.table.error.generic')}</div>
        ) : (
          <DataTable
            title={t('service_protocols.table.title')}
            columns={columns}
            data={data?.items ?? []}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1) }}
            searchAlign="right"
            filters={[
              {
                id: 'status',
                label: t('service_protocols.table.filters.status'),
                type: 'select',
                multiple: true,
                options: [
                  { value: 'draft', label: t('service_protocols.enum.status.draft') },
                  { value: 'in_review', label: t('service_protocols.enum.status.in_review') },
                  { value: 'approved', label: t('service_protocols.enum.status.approved') },
                  { value: 'closed', label: t('service_protocols.enum.status.closed') },
                  { value: 'cancelled', label: t('service_protocols.enum.status.cancelled') },
                ],
              },
            ]}
            filterValues={filterValues}
            onFiltersApply={(v) => { setFilterValues(v); setPage(1) }}
            onFiltersClear={() => { setFilterValues({}); setPage(1) }}
            sortable
            rowActions={(row) => (
              <RowActions
                items={[
                  { id: 'view', label: t('service_protocols.table.actions.view'), href: `/backend/service-protocols/${row.id}` },
                  { id: 'edit', label: t('service_protocols.table.actions.edit'), href: `/backend/service-protocols/${row.id}/edit` },
                ]}
              />
            )}
            pagination={{
              page,
              pageSize: 50,
              total: data?.totalCount ?? data?.total ?? 0,
              totalPages: Math.ceil((data?.totalCount ?? data?.total ?? 0) / 50),
              onPageChange: setPage,
            }}
            isLoading={isLoading}
            onRowClick={(row) => router.push(`/backend/service-protocols/${row.id}`)}
          />
        )}
      </PageBody>
    </Page>
  )
}
