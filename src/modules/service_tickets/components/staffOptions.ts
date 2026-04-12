import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

type EntityOption = {
  value: string
  label: string
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) return []
  return Array.isArray(payload.items) ? payload.items : []
}

export async function searchStaffMembers(query: string): Promise<EntityOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'display_name',
    sortDir: 'asc',
  })

  if (query.trim().length > 0) params.set('search', query.trim())

  const payload = await readApiResultOrThrow<Record<string, unknown>>(
    `/api/staff/team-members?${params.toString()}`,
  )

  return readItems(payload)
    .map((item) => {
      if (!isRecord(item)) return null
      const id = (item.id ?? item.entityId) as string | undefined
      if (!id) return null
      const label = (item.displayName ?? item.display_name ?? item.name ?? item.email ?? id) as string
      return { value: id, label }
    })
    .filter((item): item is EntityOption => item !== null)
}
