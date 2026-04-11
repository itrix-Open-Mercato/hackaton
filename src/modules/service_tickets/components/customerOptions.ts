import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

export type EntityOption = {
  value: string
  label: string
}

type JsonRecord = Record<string, unknown>

type CompanyDetailResponse = {
  people?: unknown[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toEntityOption(
  value: unknown,
  idKeys: readonly string[],
  labelKeys: readonly string[],
): EntityOption | null {
  if (!isRecord(value)) return null

  const id = idKeys
    .map((key) => value[key])
    .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
  if (!id) return null

  const label = labelKeys
    .map((key) => value[key])
    .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)

  return {
    value: id,
    label: label ?? id,
  }
}

export function mergeEntityOptions(existing: EntityOption[], next: EntityOption[]): EntityOption[] {
  const merged = new Map<string, EntityOption>()

  for (const option of existing) merged.set(option.value, option)
  for (const option of next) merged.set(option.value, option)

  return Array.from(merged.values())
}

function readItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) return []
  return Array.isArray(payload.items) ? payload.items : []
}

export async function searchCompanies(query: string): Promise<EntityOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })

  if (query.trim().length > 0) params.set('search', query.trim())

  const payload = await readApiResultOrThrow<Record<string, unknown>>(`/api/customers/companies?${params.toString()}`)

  return readItems(payload)
    .map((item) => toEntityOption(item, ['id', 'entityId', 'companyId'], ['displayName', 'display_name', 'label', 'name']))
    .filter((item): item is EntityOption => item !== null)
}

export async function fetchCompanyById(id: string): Promise<EntityOption | null> {
  const payload = await readApiResultOrThrow<Record<string, unknown>>(
    `/api/customers/companies?id=${encodeURIComponent(id)}&pageSize=1`,
  )

  return readItems(payload)
    .map((item) => toEntityOption(item, ['id', 'entityId', 'companyId'], ['displayName', 'display_name', 'label', 'name']))
    .find((item): item is EntityOption => item !== null) ?? null
}

export async function fetchPersonById(id: string): Promise<EntityOption | null> {
  const payload = await readApiResultOrThrow<Record<string, unknown>>(
    `/api/customers/people?id=${encodeURIComponent(id)}&pageSize=1`,
  )

  return readItems(payload)
    .map((item) => toEntityOption(item, ['id', 'entityId', 'personId'], ['displayName', 'display_name', 'label', 'name']))
    .find((item): item is EntityOption => item !== null) ?? null
}

export async function fetchCompanyPeople(companyId: string): Promise<EntityOption[]> {
  const payload = await readApiResultOrThrow<CompanyDetailResponse>(
    `/api/customers/companies/${encodeURIComponent(companyId)}?include=people`,
  )

  const people = Array.isArray(payload.people) ? payload.people : []

  return people
    .map((item: unknown) => toEntityOption(item, ['id', 'entityId', 'personId'], ['displayName', 'display_name', 'label', 'name']))
    .filter((item: EntityOption | null): item is EntityOption => item !== null)
}
