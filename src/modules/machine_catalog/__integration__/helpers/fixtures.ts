import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { getTokenContext } from '@open-mercato/core/helpers/integration/generalFixtures'

export type MachineCatalogProfileInput = {
  catalogProductId: string
  machineFamily?: string | null
  modelCode?: string | null
  defaultTeamSize?: number | null
  defaultServiceDurationMinutes?: number | null
  isActive?: boolean
}

export type MachineCatalogPartTemplateInput = {
  machineProfileId: string
  templateType: 'component' | 'consumable' | 'service_kit_item'
  partName: string
  partCode?: string | null
  serviceContext?: 'startup' | 'preventive' | 'repair' | 'reclamation' | 'maintenance_presence' | null
  quantityDefault?: number | null
  quantityUnit?: string | null
}

function uniqueCode(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

const FAKE_PRODUCT_UUID = '00000000-0000-4000-8000-000000000001'

export function createProfileInput(overrides: Partial<MachineCatalogProfileInput> = {}): MachineCatalogProfileInput {
  return {
    catalogProductId: FAKE_PRODUCT_UUID,
    machineFamily: `QA-Family-${uniqueCode('F')}`,
    modelCode: uniqueCode('MODEL'),
    defaultTeamSize: 2,
    defaultServiceDurationMinutes: 120,
    isActive: true,
    ...overrides,
  }
}

export function createPartTemplateInput(machineProfileId: string, overrides: Partial<MachineCatalogPartTemplateInput> = {}): MachineCatalogPartTemplateInput {
  return {
    machineProfileId,
    templateType: 'component',
    partName: `QA Part ${uniqueCode('PART')}`,
    partCode: uniqueCode('PC'),
    serviceContext: 'preventive',
    quantityDefault: 1,
    quantityUnit: 'szt',
    ...overrides,
  }
}

export async function readJsonSafe<T = unknown>(response: APIResponse): Promise<T | null> {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function createMachineProfile(
  request: APIRequestContext,
  token: string,
  input: MachineCatalogProfileInput,
): Promise<string> {
  const { tenantId, organizationId } = getTokenContext(token)
  const response = await apiRequest(request, 'POST', '/api/machine_catalog/machine-profiles', {
    token,
    data: { tenantId, organizationId, ...input },
  })
  const body = await readJsonSafe<{ id?: string }>(response)
  expect(response.status(), `Create machine profile failed: ${response.status()} — ${JSON.stringify(body)}`).toBe(201)
  expect(typeof body?.id === 'string' && body.id.length > 0, 'Profile id required').toBeTruthy()
  return body!.id!
}

export async function listMachineProfiles(
  request: APIRequestContext,
  token: string,
  query = '',
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const response = await apiRequest(request, 'GET', `/api/machine_catalog/machine-profiles${query ? `?${query}` : ''}`, { token })
  expect(response.ok(), `List machine profiles failed: ${response.status()}`).toBeTruthy()
  return (await readJsonSafe<{ items?: Record<string, unknown>[]; total?: number }>(response) ?? {
    items: [],
    total: 0,
  }) as { items: Record<string, unknown>[]; total: number }
}

export async function deleteMachineProfile(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    await apiRequest(request, 'DELETE', `/api/machine_catalog/machine-profiles?id=${encodeURIComponent(id)}`, { token, data: { id } })
  } catch {
    // ignore cleanup errors
  }
}

export async function createPartTemplate(
  request: APIRequestContext,
  token: string,
  input: MachineCatalogPartTemplateInput,
): Promise<string> {
  const { tenantId, organizationId } = getTokenContext(token)
  const response = await apiRequest(request, 'POST', '/api/machine_catalog/part-templates', {
    token,
    data: { tenantId, organizationId, ...input },
  })
  const body = await readJsonSafe<{ id?: string }>(response)
  expect(response.status(), `Create part template failed: ${response.status()} — ${JSON.stringify(body)}`).toBe(201)
  expect(typeof body?.id === 'string' && body.id.length > 0, 'Part template id required').toBeTruthy()
  return body!.id!
}

export async function listPartTemplates(
  request: APIRequestContext,
  token: string,
  query = '',
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const response = await apiRequest(request, 'GET', `/api/machine_catalog/part-templates${query ? `?${query}` : ''}`, { token })
  expect(response.ok(), `List part templates failed: ${response.status()}`).toBeTruthy()
  return (await readJsonSafe<{ items?: Record<string, unknown>[]; total?: number }>(response) ?? {
    items: [],
    total: 0,
  }) as { items: Record<string, unknown>[]; total: number }
}

export async function deletePartTemplate(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    await apiRequest(request, 'DELETE', `/api/machine_catalog/part-templates?id=${encodeURIComponent(id)}`, { token, data: { id } })
  } catch {
    // ignore cleanup errors
  }
}

export async function updateMachineProfile(
  request: APIRequestContext,
  token: string,
  id: string,
  data: Record<string, unknown>,
): Promise<APIResponse> {
  return apiRequest(request, 'PUT', `/api/machine_catalog/machine-profiles?id=${encodeURIComponent(id)}`, { token, data: { id, ...data } })
}
