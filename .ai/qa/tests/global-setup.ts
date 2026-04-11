/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Authenticates as "admin" via the API, saves:
 *  - JWT token → .ai/qa/.auth/token.txt  (used by getCachedToken() in API tests)
 *  - Browser storage state → .ai/qa/.auth/state.json (used via `use.storageState` for UI tests)
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const AUTH_DIR = path.resolve(__dirname, '..', '.auth')
export const TOKEN_FILE = path.join(AUTH_DIR, 'token.txt')
export const STATE_FILE = path.join(AUTH_DIR, 'state.json')

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true })

  const baseURL = process.env.BASE_URL || 'http://localhost:3000'

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })

  // Acknowledge notice banners so they don't block navigation
  await context.addCookies([
    { name: 'om_demo_notice_ack', value: 'ack', url: baseURL, sameSite: 'Lax' },
    { name: 'om_cookie_notice_ack', value: 'ack', url: baseURL, sameSite: 'Lax' },
  ])

  const page = await context.newPage()

  // POST login — API-first, same as the framework's login() helper
  const form = new URLSearchParams()
  form.set('email', 'admin@acme.com')
  form.set('password', 'secret')
  const response = await page.request.post('/api/auth/login', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  })

  if (!response.ok()) {
    await browser.close()
    throw new Error(`[global-setup] Auth failed — HTTP ${response.status()}. Is the dev server running at ${baseURL}?`)
  }

  const body = (await response.json()) as { token?: string }
  const token = body.token
  if (!token) {
    await browser.close()
    throw new Error('[global-setup] Auth response did not contain a token')
  }

  // Persist JWT for API tests
  writeFileSync(TOKEN_FILE, token, 'utf-8')

  // Set tenant/org cookies so the browser lands on the correct workspace
  const claims = decodeJwtClaims(token)
  const tenantCookies: Parameters<typeof context.addCookies>[0] = []
  if (typeof claims?.tenantId === 'string') {
    tenantCookies.push({ name: 'om_selected_tenant', value: claims.tenantId, url: baseURL, sameSite: 'Lax' })
  }
  if (typeof claims?.orgId === 'string') {
    tenantCookies.push({ name: 'om_selected_org', value: claims.orgId, url: baseURL, sameSite: 'Lax' })
  }
  if (tenantCookies.length) await context.addCookies(tenantCookies)

  // Navigate to backend to let the app hydrate auth state
  await page.goto('/backend', { waitUntil: 'domcontentloaded' })

  // Save full browser state (cookies + localStorage) for UI tests
  await context.storageState({ path: STATE_FILE })

  await browser.close()
}
