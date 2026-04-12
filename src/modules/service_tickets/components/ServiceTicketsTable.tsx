"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge, type EnumBadgeMap } from '@open-mercato/ui/backend/ValueIcons'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { deleteCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { Button } from '@open-mercato/ui/primitives/button'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ServiceTicketListItem } from '../types'
import { searchCompanies } from './customerOptions'
import { searchSalesChannels } from './salesChannelOptions'
import { searchStaffMembers } from './staffOptions'
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_VALUES,
  SERVICE_TYPE_I18N_KEYS,
  SERVICE_TYPE_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../lib/constants'
import type { TicketFilters } from './useTicketFilters'

type TicketsResponse = {
  items: ServiceTicketListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function buildStatusMap(t: (key: string) => string): EnumBadgeMap {
  return {
    new: { label: t('service_tickets.enum.status.new'), className: 'border-blue-200 text-blue-700 bg-blue-50' },
    scheduled: { label: t('service_tickets.enum.status.scheduled'), className: 'border-yellow-200 text-yellow-800 bg-yellow-50' },
    in_progress: { label: t('service_tickets.enum.status.in_progress'), className: 'border-orange-200 text-orange-700 bg-orange-50' },
    completed: { label: t('service_tickets.enum.status.completed'), className: 'border-green-200 text-green-700 bg-green-50' },
    on_hold: { label: t('service_tickets.enum.status.on_hold'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
    cancelled: { label: t('service_tickets.enum.status.cancelled'), className: 'border-red-200 text-red-700 bg-red-50' },
  }
}

function buildPriorityMap(t: (key: string) => string): EnumBadgeMap {
  return {
    normal: { label: t('service_tickets.enum.priority.normal'), className: '' },
    urgent: { label: t('service_tickets.enum.priority.urgent'), className: 'border-yellow-200 text-yellow-800 bg-yellow-50' },
    critical: { label: t('service_tickets.enum.priority.critical'), className: 'border-red-200 text-red-700 bg-red-50' },
  }
}

function buildColumns(t: (key: string) => string): ColumnDef<ServiceTicketListItem>[] {
  const statusMap = buildStatusMap(t)
  const priorityMap = buildPriorityMap(t)

  return [
    { accessorKey: 'ticketNumber', header: t('service_tickets.table.column.ticketNumber'), meta: { priority: 1 } },
    {
      id: 'companyName',
      header: t('service_tickets.table.column.companyName'),
      meta: { priority: 2 },
      accessorFn: (row) => row._service_tickets?.companyName ?? null,
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">—</span>
        return value
      },
    },
    {
      accessorKey: 'status',
      header: t('service_tickets.table.column.status'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={statusMap} />,
    },
    {
      accessorKey: 'priority',
      header: t('service_tickets.table.column.priority'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={priorityMap} />,
    },
    {
      accessorKey: 'visitDate',
      header: t('service_tickets.table.column.visitDate'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">—</span>
        return new Date(value).toLocaleDateString()
      },
    },
    {
      accessorKey: 'visitEndDate',
      header: t('service_tickets.table.column.visitEndDate'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">—</span>
        return new Date(value).toLocaleDateString()
      },
    },
    {
      id: 'technician',
      header: t('service_tickets.table.column.technician'),
      meta: { priority: 3 },
      accessorFn: (row) => row.staffMemberNames ?? [],
      cell: ({ getValue }) => {
        const names = getValue() as string[]
        if (!names.length) return <span className="text-muted-foreground">—</span>
        return names.join(', ')
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('service_tickets.table.column.createdAt'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">—</span>
        return new Date(value).toLocaleDateString()
      },
    },
  ]
}

export default function ServiceTicketsTable({ filters }: { filters: TicketFilters }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()

  const { search, setSearch, values, setValues, sorting, page, setPage, handleReset, handleSortingChange, tableParams } = filters

  const staffLabelCache = React.useRef(new Map<string, string>())
  const companyLabelCache = React.useRef(new Map<string, string>())

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data: ticketsData, isLoading, error } = useQuery<TicketsResponse>({
    queryKey: ['service_tickets', tableParams, scopeVersion],
    queryFn: async () =>
      fetchCrudList<ServiceTicketListItem>('service_tickets/tickets', Object.fromEntries(new URLSearchParams(tableParams))),
  })

  if (error) {
    return <div className="text-sm text-destructive">{t('service_tickets.table.error.generic')}</div>
  }

  return (
    <>
      <DataTable
        title={t('service_tickets.table.title')}
        actions={(
          <Button asChild>
            <Link href="/backend/service-tickets/create">{t('service_tickets.table.actions.create')}</Link>
          </Button>
        )}
        columns={columns}
        data={ticketsData?.items ?? []}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchAlign="right"
        filters={[
          {
            id: 'status',
            label: t('service_tickets.table.filters.status'),
            type: 'select',
            multiple: true,
            options: STATUS_VALUES.map((value) => ({ value, label: t(STATUS_I18N_KEYS[value]) })),
          },
          {
            id: 'service_type',
            label: t('service_tickets.table.filters.serviceType'),
            type: 'select',
            multiple: true,
            options: SERVICE_TYPE_VALUES.map((value) => ({ value, label: t(SERVICE_TYPE_I18N_KEYS[value]) })),
          },
          {
            id: 'priority',
            label: t('service_tickets.table.filters.priority'),
            type: 'select',
            multiple: true,
            options: PRIORITY_VALUES.map((value) => ({ value, label: t(PRIORITY_I18N_KEYS[value]) })),
          },
          {
            id: 'visit_date',
            label: t('service_tickets.table.filters.visitDate'),
            type: 'dateRange',
          },
          {
            id: 'created_at',
            label: t('service_tickets.table.filters.createdAt'),
            type: 'dateRange',
          },
          {
            id: 'customer_entity_id',
            label: t('service_tickets.table.filters.company'),
            type: 'combobox',
            loadOptions: async (query?: string) => {
              try {
                const options = await searchCompanies(query ?? '')
                for (const opt of options) companyLabelCache.current.set(opt.value, opt.label)
                return options
              } catch {
                return []
              }
            },
            formatValue: (val: string) => companyLabelCache.current.get(val) ?? val,
          },
          {
            id: 'staff_member_id',
            label: t('service_tickets.table.filters.technician'),
            type: 'combobox',
            loadOptions: async (query?: string) => {
              try {
                const options = await searchStaffMembers(query ?? '')
                for (const opt of options) staffLabelCache.current.set(opt.value, opt.label)
                return options
              } catch {
                return []
              }
            },
            formatValue: (val: string) => staffLabelCache.current.get(val) ?? val,
          },
          {
            id: 'sales_channel_id',
            label: t('service_tickets.table.filters.salesChannel'),
            type: 'combobox',
            loadOptions: async (query?: string) => searchSalesChannels(query ?? ''),
          },
        ]}
        filterValues={values}
        onFiltersApply={(nextValues) => {
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
              { id: 'edit', label: t('service_tickets.table.actions.edit'), href: `/backend/service-tickets/${row.id}/edit` },
              {
                id: 'delete',
                label: t('service_tickets.table.actions.delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('service_tickets.table.confirm.delete'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return

                  try {
                    await deleteCrud('service_tickets/tickets', row.id)
                    flash(t('service_tickets.form.flash.deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['service_tickets'] })
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : t('service_tickets.table.error.delete')
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
          total: ticketsData?.total || 0,
          totalPages: ticketsData?.totalPages || 0,
          onPageChange: setPage,
        }}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/backend/service-tickets/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}
