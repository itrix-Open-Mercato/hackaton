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

type ProfileRow = {
  id: string
  machineFamily: string | null
  modelCode: string | null
  catalogProductId: string | null
  isActive: boolean
}

type ProfilesResponse = {
  items: Array<Record<string, unknown>>
  total: number
  page: number
  totalPages: number
}

function mapApiProfile(item: Record<string, unknown>): ProfileRow {
  return {
    id: typeof item.id === 'string' ? item.id : '',
    machineFamily: typeof item.machine_family === 'string' ? item.machine_family : null,
    modelCode: typeof item.model_code === 'string' ? item.model_code : null,
    catalogProductId: typeof item.catalog_product_id === 'string' ? item.catalog_product_id : null,
    isActive: item.is_active === true,
  }
}

export default function MachineCatalogPage() {
  const [rows, setRows] = React.useState<ProfileRow[]>([])
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
          body: JSON.stringify({ features: ['machine_catalog.manage'] }),
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
        const fallback: ProfilesResponse = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ProfilesResponse>(`/api/machine-catalog/machine-profiles?${params.toString()}`, undefined, { fallback })
        if (!call.ok) { flash('Failed to load machine catalog profiles.', 'error'); return }
        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows((payload.items ?? []).map(mapApiProfile))
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

  const handleDelete = React.useCallback(async (row: ProfileRow) => {
    const label = row.machineFamily ?? row.modelCode ?? row.id
    const confirmed = await confirm({ title: `Delete machine profile "${label}"?`, variant: 'destructive' })
    if (!confirmed) return
    try {
      await deleteCrud('machine-catalog/machine-profiles', row.id)
      flash('Machine profile deleted.', 'success')
      setPage(1)
      router.refresh()
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Failed to delete.', 'error')
    }
  }, [confirm, router])

  const columns = React.useMemo<ColumnDef<ProfileRow>[]>(() => [
    {
      accessorKey: 'machineFamily',
      header: t('machine_catalog.list.columns.machineFamily', 'Machine Family'),
      meta: { priority: 1 },
      cell: ({ getValue }) => getValue() ?? <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'modelCode',
      header: t('machine_catalog.list.columns.modelCode', 'Model Code'),
      meta: { priority: 2 },
      cell: ({ getValue }) => getValue() ?? <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'catalogProductId',
      header: t('machine_catalog.list.columns.catalogProductId', 'Catalog Product'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? <span className="font-mono text-xs">{v}</span> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'isActive',
      header: t('machine_catalog.list.columns.active', 'Active'),
      meta: { priority: 4 },
      cell: ({ getValue }) => <BooleanIcon value={getValue() as boolean} />,
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('machine_catalog.page.title', 'Machine Catalog')}
          actions={canManage ? (
            <Button asChild>
              <Link href="/backend/machine-catalog/create">{t('machine_catalog.list.actions.create', 'New profile')}</Link>
            </Button>
          ) : null}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          perspective={{ tableId: 'machine_catalog.list' }}
          rowActions={(row) => canManage ? (
            <RowActions items={[
              { id: 'edit', label: t('common.edit', 'Edit'), href: `/backend/machine-catalog/${encodeURIComponent(row.id)}` },
              { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: () => { void handleDelete(row) } },
            ]} />
          ) : null}
          onRowClick={canManage ? (row) => router.push(`/backend/machine-catalog/${encodeURIComponent(row.id)}`) : undefined}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
