"use client"
import * as React from 'react'
import type { SortingState } from '@tanstack/react-table'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'

export interface TicketFilters {
  search: string
  setSearch: (v: string) => void
  values: FilterValues
  setValues: (v: FilterValues) => void
  sorting: SortingState
  setSorting: (v: SortingState) => void
  page: number
  setPage: (v: number) => void
  handleReset: () => void
  handleSortingChange: (v: SortingState) => void
  /** Full query string for the DataTable (includes page, pageSize, sort). */
  tableParams: string
  /** Filter-only query string for the map (no pagination or sort fields). */
  filterParams: string
}

function appendFilterParam(params: URLSearchParams, key: string, value: unknown) {
  if (value == null || value === '') return

  if (Array.isArray(value)) {
    if (value.length === 0) return
    params.set(key, value.map(String).join(','))
    return
  }

  if (typeof value === 'object') {
    const range = value as { from?: unknown; to?: unknown }
    const from = typeof range.from === 'string' ? range.from : ''
    const to = typeof range.to === 'string' ? range.to : ''

    if (from) params.set(`${key}_from`, from)
    if (to) params.set(`${key}_to`, to)
    return
  }

  params.set(key, String(value))
}

export function useTicketFilters(): TicketFilters {
  const [search, setSearch] = React.useState('')
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [page, setPage] = React.useState(1)

  const filterParams = React.useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    Object.entries(values).forEach(([key, value]) => {
      appendFilterParam(params, key, value)
    })
    return params.toString()
  }, [search, values])

  const tableParams = React.useMemo(() => {
    const params = new URLSearchParams(filterParams)
    params.set('page', page.toString())
    params.set('pageSize', '50')
    params.set('sortField', sorting[0]?.id || 'createdAt')
    params.set('sortDir', sorting[0]?.desc ? 'desc' : 'asc')
    return params.toString()
  }, [filterParams, page, sorting])

  const handleSortingChange = React.useCallback((newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }, [])

  const handleReset = React.useCallback(() => {
    setSearch('')
    setValues({})
    setPage(1)
  }, [])

  return {
    search,
    setSearch,
    values,
    setValues,
    sorting,
    setSorting,
    page,
    setPage,
    handleReset,
    handleSortingChange,
    tableParams,
    filterParams,
  }
}
