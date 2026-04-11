"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { RowActionItem } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge, type EnumBadgeMap } from '@open-mercato/ui/backend/ValueIcons'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Input } from '@open-mercato/ui/primitives/input'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ServiceTicketListItem } from '../../service_tickets/types'
import type { PhoneCallListItem, TillioSyncResult } from '../types'
import {
  DIRECTION_I18N_KEYS,
  DIRECTION_VALUES,
  STATUS_I18N_KEYS,
  STATUS_VALUES,
} from '../lib/constants'

type PhoneCallsResponse = {
  items: PhoneCallListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type ServiceTicketsResponse = {
  items: ServiceTicketListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type ServiceTicketPrefill = {
  phone_call_id: string
  service_type: string
  priority: string
  description: string
  address: string | null
  visit_date: string | null
  customer_entity_id: string | null
  contact_person_id: string | null
  machine_asset_id: string | null
}

function buildDirectionMap(t: (key: string) => string): EnumBadgeMap {
  return {
    inbound: { label: t('phone_calls.enum.direction.inbound'), className: 'border-blue-200 text-blue-700 bg-blue-50' },
    outbound: { label: t('phone_calls.enum.direction.outbound'), className: 'border-green-200 text-green-700 bg-green-50' },
    internal: { label: t('phone_calls.enum.direction.internal'), className: '' },
    unknown: { label: t('phone_calls.enum.direction.unknown'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
  }
}

function buildStatusMap(t: (key: string) => string): EnumBadgeMap {
  return {
    new: { label: t('phone_calls.enum.status.new'), className: 'border-blue-200 text-blue-700 bg-blue-50' },
    synced: { label: t('phone_calls.enum.status.synced'), className: '' },
    answered: { label: t('phone_calls.enum.status.answered'), className: 'border-green-200 text-green-700 bg-green-50' },
    missed: { label: t('phone_calls.enum.status.missed'), className: 'border-yellow-200 text-yellow-800 bg-yellow-50' },
    failed: { label: t('phone_calls.enum.status.failed'), className: 'border-red-200 text-red-700 bg-red-50' },
    unknown: { label: t('phone_calls.enum.status.unknown'), className: 'border-gray-200 text-gray-600 bg-gray-50' },
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function buildTicketHref(prefill: ServiceTicketPrefill): string {
  const params = new URLSearchParams({
    phone_call_id: prefill.phone_call_id,
    service_type: prefill.service_type,
    priority: prefill.priority,
    description: prefill.description,
  })
  if (prefill.address) params.set('address', prefill.address)
  if (prefill.visit_date) params.set('visit_date', prefill.visit_date)
  if (prefill.customer_entity_id) params.set('customer_entity_id', prefill.customer_entity_id)
  if (prefill.contact_person_id) params.set('contact_person_id', prefill.contact_person_id)
  if (prefill.machine_asset_id) params.set('machine_asset_id', prefill.machine_asset_id)
  return `/backend/service-tickets/create?${params.toString()}`
}

function buildColumns(t: (key: string) => string): ColumnDef<PhoneCallListItem>[] {
  const directionMap = buildDirectionMap(t)
  const statusMap = buildStatusMap(t)
  return [
    {
      accessorKey: 'startedAt',
      header: t('phone_calls.table.column.startedAt'),
      meta: { priority: 1 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">-</span>
        return new Date(value).toLocaleString()
      },
    },
    {
      accessorKey: 'callerPhoneNumber',
      header: t('phone_calls.table.column.caller'),
      meta: { priority: 1 },
      cell: ({ getValue }) => String(getValue() || '-'),
    },
    {
      accessorKey: 'calleePhoneNumber',
      header: t('phone_calls.table.column.callee'),
      meta: { priority: 2 },
      cell: ({ getValue }) => String(getValue() || '-'),
    },
    {
      accessorKey: 'direction',
      header: t('phone_calls.table.column.direction'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={directionMap} />,
    },
    {
      accessorKey: 'status',
      header: t('phone_calls.table.column.status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={statusMap} />,
    },
    {
      accessorKey: 'durationSeconds',
      header: t('phone_calls.table.column.duration'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const value = getValue() as number | null
        return value == null ? <span className="text-muted-foreground">-</span> : `${value}s`
      },
    },
    {
      accessorKey: 'serviceTicketId',
      header: t('phone_calls.table.column.serviceTicket'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        if (!value) return <span className="text-muted-foreground">{t('phone_calls.table.noTicket')}</span>
        return <Link className="text-primary underline-offset-4 hover:underline" href={`/backend/service-tickets/${value}/edit`}>{t('phone_calls.table.openTicket')}</Link>
      },
    },
  ]
}

export default function PhoneCallsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'startedAt', desc: true }])
  const [page, setPage] = React.useState(1)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [linkDialogCall, setLinkDialogCall] = React.useState<PhoneCallListItem | null>(null)
  const [ticketSearch, setTicketSearch] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'startedAt',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (search) params.set('search', search)
    Object.entries(values).forEach(([key, value]) => {
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return
      if (Array.isArray(value)) params.set(key, value.map(String).join(','))
      else params.set(key, String(value))
    })
    return params.toString()
  }, [page, search, sorting, values])

  const columns = React.useMemo(() => buildColumns(t), [t])
  const { data: callsData, isLoading, error } = useQuery<PhoneCallsResponse>({
    queryKey: ['phone_calls', queryParams, scopeVersion],
    queryFn: async () =>
      fetchCrudList<PhoneCallListItem>('phone_calls/calls', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const ticketQueryParams = React.useMemo(() => {
    const params = new URLSearchParams({ page: '1', pageSize: '10', sortField: 'createdAt', sortDir: 'desc' })
    if (ticketSearch) params.set('search', ticketSearch)
    return params.toString()
  }, [ticketSearch])

  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery<ServiceTicketsResponse>({
    queryKey: ['phone_calls', 'linkable_service_tickets', ticketQueryParams, scopeVersion, linkDialogCall?.id ?? null],
    enabled: Boolean(linkDialogCall),
    queryFn: async () =>
      fetchCrudList<ServiceTicketListItem>('service_tickets/tickets', Object.fromEntries(new URLSearchParams(ticketQueryParams))),
  })

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const call = await apiCallOrThrow<TillioSyncResult>('/api/phone_calls/sync/tillio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = call.result
      flash(
        t('phone_calls.table.flash.synced')
          .replace('{created}', String(result?.created ?? 0))
          .replace('{updated}', String(result?.updated ?? 0))
          .replace('{summarized}', String(result?.summarized ?? 0)),
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['phone_calls'] })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.table.error.sync')
      flash(message, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const runArtifactAction = async (row: PhoneCallListItem, action: 'generate-transcript' | 'regenerate-summary') => {
    try {
      await apiCallOrThrow(`/api/phone_calls/calls/${row.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recording_url: row.recordingUrl ?? undefined }),
      })
      flash(t(action === 'generate-transcript' ? 'phone_calls.table.flash.transcriptQueued' : 'phone_calls.table.flash.summaryQueued'), 'success')
      queryClient.invalidateQueries({ queryKey: ['phone_calls'] })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.table.error.artifact')
      flash(message, 'error')
    }
  }

  const createTicketFromCall = async (row: PhoneCallListItem) => {
    try {
      const call = await apiCallOrThrow<ServiceTicketPrefill>(`/api/phone_calls/calls/${row.id}/service-ticket-prefill`)
      if (!call.result) throw new Error(t('phone_calls.table.error.prefill'))
      router.push(buildTicketHref(call.result))
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.table.error.prefill')
      flash(message, 'error')
    }
  }

  const linkServiceTicket = async (row: PhoneCallListItem, serviceTicketId: string | null, sourceAction: 'link_existing' | 'unlink') => {
    try {
      await apiCallOrThrow(`/api/phone_calls/calls/${row.id}/link-service-ticket`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service_ticket_id: serviceTicketId, source_action: sourceAction }),
      })
      flash(t(serviceTicketId ? 'phone_calls.table.flash.ticketLinked' : 'phone_calls.table.flash.ticketUnlinked'), 'success')
      setLinkDialogCall(null)
      setTicketSearch('')
      queryClient.invalidateQueries({ queryKey: ['phone_calls'] })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('phone_calls.table.error.linkTicket')
      flash(message, 'error')
    }
  }

  const handleReset = () => {
    setSearch('')
    setValues({})
    setPage(1)
  }

  if (error) return <div className="text-sm text-destructive">{t('phone_calls.table.error.generic')}</div>

  return (
    <>
    <DataTable
      title={t('phone_calls.table.title')}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/backend/phone-calls/settings">{t('phone_calls.table.actions.settings')}</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/backend/phone-calls/operations">{t('phone_calls.table.actions.operations')}</Link>
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? t('phone_calls.table.actions.syncing') : t('phone_calls.table.actions.sync')}
          </Button>
        </div>
      )}
      columns={columns}
      data={callsData?.items ?? []}
      searchValue={search}
      onSearchChange={(value) => {
        setSearch(value)
        setPage(1)
      }}
      searchAlign="right"
      filters={[
        {
          id: 'direction',
          label: t('phone_calls.table.filters.direction'),
          type: 'select',
          multiple: true,
          options: DIRECTION_VALUES.map((value) => ({ value, label: t(DIRECTION_I18N_KEYS[value]) })),
        },
        {
          id: 'status',
          label: t('phone_calls.table.filters.status'),
          type: 'select',
          multiple: true,
          options: STATUS_VALUES.map((value) => ({ value, label: t(STATUS_I18N_KEYS[value]) })),
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
      onSortingChange={(nextSorting) => {
        setSorting(nextSorting)
        setPage(1)
      }}
      rowActions={(row) => {
        const items: RowActionItem[] = [
            { id: 'details', label: t('phone_calls.table.actions.details'), href: `/backend/phone-calls/${row.id}` },
            { id: 'createTicket', label: t('phone_calls.table.actions.createTicket'), onSelect: () => { void createTicketFromCall(row) } },
            row.serviceTicketId
              ? { id: 'ticket', label: t('phone_calls.table.actions.openTicket'), href: `/backend/service-tickets/${row.serviceTicketId}/edit` }
              : { id: 'linkTicket', label: t('phone_calls.table.actions.linkTicket'), onSelect: () => { setLinkDialogCall(row) } },
            {
              id: 'transcript',
              label: t('phone_calls.table.actions.generateTranscript'),
              onSelect: () => {
                if (!row.recordingUrl) {
                  flash(t('phone_calls.table.error.recordingRequired'), 'error')
                  return
                }
                runArtifactAction(row, 'generate-transcript')
              },
            },
            {
              id: 'summary',
              label: t('phone_calls.table.actions.regenerateSummary'),
              onSelect: () => {
                if (!row.recordingUrl) {
                  flash(t('phone_calls.table.error.recordingRequired'), 'error')
                  return
                }
                runArtifactAction(row, 'regenerate-summary')
              },
            },
        ]
        if (row.serviceTicketId) {
          items.splice(3, 0, {
            id: 'unlinkTicket',
            label: t('phone_calls.table.actions.unlinkTicket'),
            destructive: true,
            onSelect: () => { void linkServiceTicket(row, null, 'unlink') },
          })
        }
        return <RowActions items={items} />
      }}
      pagination={{
        page,
        pageSize: 50,
        total: callsData?.total || 0,
        totalPages: callsData?.totalPages || 0,
        onPageChange: setPage,
      }}
      isLoading={isLoading}
    />
    <Dialog open={Boolean(linkDialogCall)} onOpenChange={(open) => {
      if (!open) {
        setLinkDialogCall(null)
        setTicketSearch('')
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('phone_calls.linkDialog.title')}</DialogTitle>
          <DialogDescription>{t('phone_calls.linkDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={ticketSearch}
            onChange={(event) => setTicketSearch(event.target.value)}
            placeholder={t('phone_calls.linkDialog.searchPlaceholder')}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {isLoadingTickets ? (
              <div className="text-sm text-muted-foreground">{t('phone_calls.linkDialog.loading')}</div>
            ) : ticketsData?.items.length ? (
              ticketsData.items.map((ticket) => (
                <Button
                  key={ticket.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full flex-col items-start justify-start gap-1 rounded-md border p-3 text-left hover:bg-muted"
                  onClick={() => {
                    if (linkDialogCall) void linkServiceTicket(linkDialogCall, ticket.id, 'link_existing')
                  }}
                >
                  <span className="text-sm font-medium">{ticket.ticketNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {[ticket.status, ticket.priority, ticket.description].filter(Boolean).join(' · ')}
                  </span>
                </Button>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{t('phone_calls.linkDialog.empty')}</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setLinkDialogCall(null)}>
            {t('phone_calls.linkDialog.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
