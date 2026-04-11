"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

const PAGE_SIZE = 25

type MachineRow = {
  id: string
  instanceCode: string
  serialNumber: string | null
  customerCompanyId: string | null
  siteName: string | null
  warrantyStatus: string | null
  nextInspectionAt: string | null
  isActive: boolean
}

type MachinesResponse = {
  items: Array<Record<string, unknown>>
  total: number
  page: number
  totalPages: number
}

function mapApiMachine(item: Record<string, unknown>): MachineRow {
  return {
    id: typeof item.id === 'string' ? item.id : '',
    instanceCode: typeof item.instance_code === 'string' ? item.instance_code : '',
    serialNumber: typeof item.serial_number === 'string' ? item.serial_number : null,
    customerCompanyId: typeof item.customer_company_id === 'string' ? item.customer_company_id : null,
    siteName: typeof item.site_name === 'string' ? item.site_name : null,
    warrantyStatus: typeof item.warranty_status === 'string' ? item.warranty_status : null,
    nextInspectionAt: typeof item.next_inspection_at === 'string' ? item.next_inspection_at : null,
    isActive: item.is_active === true,
  }
}

function warrantyBadge(status: string | null) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    claim: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

export default function MachineInstancesPage() {
  const [rows, setRows] = React.useState<MachineRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const scopeVersion = useOrganizationScopeVersion()
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const router = useRouter()

  React.useEffect(() => {
    let cancelled = false
    async function loadPermissions() {
      try {
        const call = await apiCall<{ ok?: boolean }>('/api/auth/feature-check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: ['machine_instances.manage'] }),
        })
        if (!cancelled) setCanManage(call.result?.ok === true)
      } catch { if (!cancelled) setCanManage(false) }
    }
    loadPermissions()
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
        if (search) params.set('search', search)
        const fallback: MachinesResponse = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<MachinesResponse>(`/api/machine-instances/machines?${params.toString()}`, undefined, { fallback })
        if (!call.ok) { flash('Failed to load machine instances.', 'error'); return }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows((payload.items ?? []).map(mapApiMachine))
          setTotal(payload.total ?? 0)
          setTotalPages(payload.totalPages ?? 1)
        }
      } catch (error) {
        if (!cancelled) flash(error instanceof Error ? error.message : 'Failed to load.', 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [page, search, scopeVersion])

  const handleDelete = React.useCallback(async (row: MachineRow) => {
    const confirmed = await confirm({ title: `Delete machine "${row.instanceCode}"?`, variant: 'destructive' })
    if (!confirmed) return
    try {
      await deleteCrud('machine-instances/machines', row.id)
      flash('Machine instance deleted.', 'success')
      setPage(1)
      router.refresh()
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Failed to delete.', 'error')
    }
  }, [confirm, router])

  const columns = React.useMemo<ColumnDef<MachineRow>[]>(() => [
    {
      accessorKey: 'instanceCode',
      header: t('machine_instances.list.columns.instanceCode', 'Code'),
      meta: { priority: 1 },
    },
    {
      accessorKey: 'serialNumber',
      header: t('machine_instances.list.columns.serialNumber', 'Serial No.'),
      meta: { priority: 2 },
      cell: ({ getValue }) => getValue() ?? <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'siteName',
      header: t('machine_instances.list.columns.siteName', 'Site'),
      meta: { priority: 3 },
      cell: ({ getValue }) => getValue() ?? <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'warrantyStatus',
      header: t('machine_instances.list.columns.warrantyStatus', 'Warranty'),
      meta: { priority: 4 },
      cell: ({ getValue }) => warrantyBadge(getValue() as string | null),
    },
    {
      accessorKey: 'nextInspectionAt',
      header: t('machine_instances.list.columns.nextInspection', 'Next Inspection'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? new Date(v).toLocaleDateString() : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'isActive',
      header: t('machine_instances.list.columns.active', 'Active'),
      meta: { priority: 6 },
      cell: ({ getValue }) => <BooleanIcon value={getValue() as boolean} />,
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('machine_instances.page.title', 'Machine Instances')}
          actions={canManage ? (
            <Button asChild>
              <Link href="/backend/machine-instances/create">{t('machine_instances.list.actions.create', 'New machine')}</Link>
            </Button>
          ) : null}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          perspective={{ tableId: 'machine_instances.list' }}
          rowActions={(row) => canManage ? (
            <RowActions items={[
              { id: 'edit', label: t('common.edit', 'Edit'), href: `/backend/machine-instances/${encodeURIComponent(row.id)}` },
              { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: () => { void handleDelete(row) } },
            ]} />
          ) : null}
          onRowClick={canManage ? (row) => router.push(`/backend/machine-instances/${encodeURIComponent(row.id)}`) : undefined}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
