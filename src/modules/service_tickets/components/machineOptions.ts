"use client"

import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

type JsonRecord = Record<string, unknown>

export type MachineLookupRecord = {
  id: string
  instanceCode: string
  serialNumber: string | null
  customerCompanyId: string | null
  catalogProductId: string | null
  siteName: string | null
  siteAddress: JsonRecord | null
  locationLabel: string | null
}

export type MachineProfileRecord = {
  id: string
  catalogProductId: string
  machineFamily: string | null
  modelCode: string | null
  preventiveMaintenanceIntervalDays: number | null
  defaultWarrantyMonths: number | null
}

export type MachineServiceTypeRecord = {
  id: string
  serviceType: string
  defaultTeamSize: number | null
  defaultServiceDurationMinutes: number | null
  startupNotes: string | null
  serviceNotes: string | null
}

export type MachineOption = {
  value: string
  label: string
  record: MachineLookupRecord
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) return []
  return Array.isArray(payload.items) ? payload.items : []
}

function readString(record: JsonRecord, camelKey: string, snakeKey: string): string | null {
  const value = record[camelKey] ?? record[snakeKey]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readNumber(record: JsonRecord, camelKey: string, snakeKey: string): number | null {
  const value = record[camelKey] ?? record[snakeKey]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readNullableObject(record: JsonRecord, camelKey: string, snakeKey: string): JsonRecord | null {
  const value = record[camelKey] ?? record[snakeKey]
  return isRecord(value) ? value : null
}

function toMachineLookupRecord(value: unknown): MachineLookupRecord | null {
  if (!isRecord(value)) return null

  const id = readString(value, 'id', 'id')
  const instanceCode = readString(value, 'instanceCode', 'instance_code')
  if (!id || !instanceCode) return null

  return {
    id,
    instanceCode,
    serialNumber: readString(value, 'serialNumber', 'serial_number'),
    customerCompanyId: readString(value, 'customerCompanyId', 'customer_company_id'),
    catalogProductId: readString(value, 'catalogProductId', 'catalog_product_id'),
    siteName: readString(value, 'siteName', 'site_name'),
    siteAddress: readNullableObject(value, 'siteAddress', 'site_address'),
    locationLabel: readString(value, 'locationLabel', 'location_label'),
  }
}

function toMachineProfileRecord(value: unknown): MachineProfileRecord | null {
  if (!isRecord(value)) return null

  const id = readString(value, 'id', 'id')
  const catalogProductId = readString(value, 'catalogProductId', 'catalog_product_id')
  if (!id || !catalogProductId) return null

  return {
    id,
    catalogProductId,
    machineFamily: readString(value, 'machineFamily', 'machine_family'),
    modelCode: readString(value, 'modelCode', 'model_code'),
    preventiveMaintenanceIntervalDays: readNumber(
      value,
      'preventiveMaintenanceIntervalDays',
      'preventive_maintenance_interval_days',
    ),
    defaultWarrantyMonths: readNumber(value, 'defaultWarrantyMonths', 'default_warranty_months'),
  }
}

function toMachineServiceTypeRecord(value: unknown): MachineServiceTypeRecord | null {
  if (!isRecord(value)) return null

  const id = readString(value, 'id', 'id')
  const serviceType = readString(value, 'serviceType', 'service_type')
  if (!id || !serviceType) return null

  return {
    id,
    serviceType,
    defaultTeamSize: readNumber(value, 'defaultTeamSize', 'default_team_size'),
    defaultServiceDurationMinutes: readNumber(value, 'defaultServiceDurationMinutes', 'default_service_duration_minutes'),
    startupNotes: readString(value, 'startupNotes', 'startup_notes'),
    serviceNotes: readString(value, 'serviceNotes', 'service_notes'),
  }
}

export function buildMachineLabel(record: MachineLookupRecord): string {
  return [
    record.instanceCode,
    record.serialNumber,
    record.siteName,
    record.locationLabel,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' • ')
}

export function formatMachineAddress(record: MachineLookupRecord): string | null {
  const address = record.siteAddress
  const addressParts = address
    ? [
        'formatted',
        'fullAddress',
        'street',
        'line1',
        'line2',
        'postalCode',
        'zipCode',
        'city',
        'country',
      ]
        .map((key) => address[key])
        .filter((value, index, array): value is string =>
          typeof value === 'string' &&
          value.trim().length > 0 &&
          array.indexOf(value) === index,
        )
    : []

  const parts = [record.siteName, addressParts.join(', '), record.locationLabel]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  return parts.length > 0 ? parts.join(' • ') : null
}

function toMachineOption(record: MachineLookupRecord): MachineOption {
  return {
    value: record.id,
    label: buildMachineLabel(record),
    record,
  }
}

export function mergeMachineOptions(existing: MachineOption[], next: MachineOption[]): MachineOption[] {
  const merged = new Map<string, MachineOption>()

  for (const option of existing) merged.set(option.value, option)
  for (const option of next) merged.set(option.value, option)

  return Array.from(merged.values())
}

export async function searchMachines(query: string): Promise<MachineOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'instanceCode',
    sortDir: 'asc',
  })

  if (query.trim().length > 0) params.set('search', query.trim())

  const payload = await readApiResultOrThrow<Record<string, unknown>>(`/api/machine_instances/machines?${params.toString()}`)

  return readItems(payload)
    .map(toMachineLookupRecord)
    .filter((item): item is MachineLookupRecord => item !== null)
    .map(toMachineOption)
}

export async function fetchMachineById(id: string): Promise<MachineOption | null> {
  const payload = await readApiResultOrThrow<Record<string, unknown>>(
    `/api/machine_instances/machines?ids=${encodeURIComponent(id)}&pageSize=1`,
  )

  return (
    readItems(payload)
      .map(toMachineLookupRecord)
      .filter((item): item is MachineLookupRecord => item !== null)
      .map(toMachineOption)[0] ?? null
  )
}

export async function fetchMachineProfileByCatalogProductId(catalogProductId: string): Promise<MachineProfileRecord | null> {
  const payload = await readApiResultOrThrow<Record<string, unknown>>(
    `/api/machine_catalog/machine-profiles?catalogProductId=${encodeURIComponent(catalogProductId)}&pageSize=1`,
  )

  return (
    readItems(payload)
      .map(toMachineProfileRecord)
      .filter((item): item is MachineProfileRecord => item !== null)[0] ?? null
  )
}

export async function fetchMachineServiceTypes(machineProfileId: string): Promise<MachineServiceTypeRecord[]> {
  const params = new URLSearchParams({
    machineProfileId,
    pageSize: '50',
    sortField: 'sortOrder',
    sortDir: 'asc',
  })

  const payload = await readApiResultOrThrow<Record<string, unknown>>(`/api/machine_catalog/service-types?${params.toString()}`)

  return readItems(payload)
    .map(toMachineServiceTypeRecord)
    .filter((item): item is MachineServiceTypeRecord => item !== null)
}
