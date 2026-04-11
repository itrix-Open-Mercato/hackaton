import { expect, test } from '@playwright/test'

test('diagnose service tickets API', async ({ page }) => {
  test.setTimeout(45_000)

  const { login } = await import('@open-mercato/core/helpers/integration/auth')
  const { getAuthToken } = await import('@open-mercato/core/helpers/integration/api')
  await login(page, 'admin')

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  await page.context().addCookies([
    { name: 'om_feedback_suppress', value: '1', url: baseUrl, sameSite: 'Lax' },
  ])

  // Intercept the tickets API to see the error
  const apiErrors: { url: string; status: number; body: string }[] = []
  page.on('response', async (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      try {
        const body = await response.text()
        apiErrors.push({ url: response.url(), status: response.status(), body: body.substring(0, 1000) })
      } catch {
        apiErrors.push({ url: response.url(), status: response.status(), body: '(unreadable)' })
      }
    }
  })

  await page.goto(`${baseUrl}/backend/service-tickets`)
  // Wait for content to appear (either success or error) - don't use networkidle
  await page.waitForSelector('text=Service Tickets, text=Failed to load, text=Zlecenia', { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(5000)

  await page.screenshot({ path: '.ai/qa/test-results/artifacts/diag-table.png', fullPage: true })

  console.log('\n=== API ERRORS (status >= 400) ===')
  for (const e of apiErrors) {
    console.log(`[${e.status}] ${e.url}`)
    console.log(`  ${e.body}\n`)
  }

  // The test passes regardless — we just want to see the output
  expect(true).toBe(true)
})
