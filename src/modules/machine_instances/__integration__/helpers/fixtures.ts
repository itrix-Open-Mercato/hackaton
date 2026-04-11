import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { getTokenContext } from '@open-mercato/core/helpers/integration/generalFixtures'

export type MachineInstanceInput = {
  instanceCode: string
  serialNumber?: string | null
  siteName?: string | null
  warrantyStatus?: 'active' | 'expired' | 'claim' | null
  isActive?: boolean
}

function uniqueCode(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function createMachineInstanceInput(overrides: Partial<MachineInstanceInput> = {}): MachineInstanceInput {
  return {
    instanceCode: uniqueCode('MI'),
    serialNumber: uniqueCode('SN'),
    siteName: 'QA Test Site',
    isActive: true,
    ...overrides,
  }
}

export async function createMachineInstance(
  request: APIRequestContext,
  token: string,
  input: MachineInstanceInput,
): Promise<string> {
  const { tenantId, organizationId } = getTokenContext(token)
  const response = await apiRequest(request, 'POST', '/api/machine_instances/machines', {
    token,
    data: { tenantId, organizationId, ...input },
  })
  const body = await readJsonSafe<{ id?: string }>(response)
  expect(response.status(), `Create machine instance failed: ${response.status()}`).toBe(201)
  expect(typeof body?.id === 'string' && body.id.length > 0, 'Machine instance id is required').toBeTruthy()
  return body!.id!
}

export async function listMachineInstances(
  request: APIRequestContext,
  token: string,
  query = '',
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const response = await apiRequest(request, 'GET', `/api/machine_instances/machines${query ? `?${query}` : ''}`, { token })
  expect(response.ok(), `List machine instances failed: ${response.status()}`).toBeTruthy()
  return (await readJsonSafe<{ items?: Record<string, unknown>[]; total?: number }>(response) ?? {
    items: [],
    total: 0,
  }) as { items: Record<string, unknown>[]; total: number }
}

export async function updateMachineInstance(
  request: APIRequestContext,
  token: string,
  id: string,
  data: Record<string, unknown>,
): Promise<APIResponse> {
  return apiRequest(request, 'PUT', `/api/machine_instances/machines?id=${encodeURIComponent(id)}`, { token, data: { id, ...data } })
}

export async function deleteMachineInstance(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    await apiRequest(request, 'DELETE', `/api/machine_instances/machines?id=${encodeURIComponent(id)}`, { token, data: { id } })
  } catch {
    // ignore cleanup errors
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
