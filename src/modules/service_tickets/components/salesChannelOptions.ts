"use client"

import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntityOption } from './customerOptions'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSalesChannelOption(item: unknown): EntityOption | null {
  if (!isRecord(item)) return null

  const id = typeof item.id === 'string' && item.id.trim() ? item.id : null
  if (!id) return null

  const name = typeof item.name === 'string' && item.name.trim() ? item.name : null
  const code = typeof item.code === 'string' && item.code.trim() ? item.code : null

  return { value: id, label: name || code || id }
}

export async function searchSalesChannels(query: string): Promise<EntityOption[]> {
  const params = new URLSearchParams({ page: '1', pageSize: '50', sortField: 'name', sortDir: 'asc' })
  const trimmed = query.trim()
  if (trimmed) params.set('search', trimmed)

  try {
    const response = await apiCall<{ items?: unknown[] }>(`/api/sales/channels?${params.toString()}`)
    if (!response.ok || !Array.isArray(response.result?.items)) return []
    return response.result.items
      .map(toSalesChannelOption)
      .filter((option): option is EntityOption => option !== null)
  } catch {
    return []
  }
}
