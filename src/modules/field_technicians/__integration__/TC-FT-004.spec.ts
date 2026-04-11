/**
 * TC-FT-004: Field Technician Certification Detail UI
 * Source: .ai/specs/2026-04-10-field-technicians-module.md — UI / UX
 *
 * Covers:
 *   - Certification tab renders seeded certification records
 *   - Expired and expiring-soon badges are shown in the technician card UI
 *   - Certification cards are shown in expires_at ascending order
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'
import { login } from '@open-mercato/core/helpers/integration/auth'

function isoDate(daysFromNow: number): string {
  const value = new Date()
  value.setUTCHours(12, 0, 0, 0)
  value.setUTCDate(value.getUTCDate() + daysFromNow)
  return value.toISOString()
}

test.describe('TC-FT-004: Field Technician Certification Detail UI', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function deleteCertificationIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/field-technicians/certifications?id=${id}`, { token })
    } catch {
      // ignore cleanup failures
    }
  }

  async function deleteTechnicianIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/field-technicians?id=${id}`, { token })
    } catch {
      // ignore cleanup failures
    }
  }

  test('TC-FT-U01: certification tab shows expiry badges and sorted certification cards', async ({ page, request }) => {
    let technicianId: string | null = null
    let expiredCertId: string | null = null
    let expiringSoonCertId: string | null = null
    let validCertId: string | null = null

    const expiredName = `QA Expired ${Date.now()}`
    const expiringSoonName = `QA Expiring Soon ${Date.now()}`
    const validName = `QA Valid ${Date.now()}`

    try {
      const createTechnicianRes = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: {
          displayName: `QA FT UI ${Date.now()}`,
          email: `qa.ft.ui.${Date.now()}@example.com`,
        },
      })
      expect(createTechnicianRes.ok()).toBeTruthy()
      technicianId = (await createTechnicianRes.json()).id

      const [expiredRes, expiringSoonRes, validRes] = await Promise.all([
        apiRequest(request, 'POST', '/api/field-technicians/certifications', {
          token,
          data: {
            technicianId,
            name: expiredName,
            certType: 'other',
            expiresAt: isoDate(-5),
          },
        }),
        apiRequest(request, 'POST', '/api/field-technicians/certifications', {
          token,
          data: {
            technicianId,
            name: expiringSoonName,
            certType: 'other',
            expiresAt: isoDate(10),
          },
        }),
        apiRequest(request, 'POST', '/api/field-technicians/certifications', {
          token,
          data: {
            technicianId,
            name: validName,
            certType: 'other',
            expiresAt: isoDate(90),
          },
        }),
      ])

      expiredCertId = (await expiredRes.json()).id
      expiringSoonCertId = (await expiringSoonRes.json()).id
      validCertId = (await validRes.json()).id

      await login(page, 'admin')
      await page.goto(`/backend/field-technicians/${technicianId}`, { waitUntil: 'domcontentloaded' })

      await page.getByRole('button', { name: /Certifications & Permissions/i }).click()

      await expect(page.getByText(expiredName)).toBeVisible()
      await expect(page.getByText(expiringSoonName)).toBeVisible()
      await expect(page.getByText(validName)).toBeVisible()
      await expect(page.getByText('Expired')).toBeVisible()
      await expect(page.getByText('Expiring soon')).toBeVisible()

      const expiredBox = await page.getByText(expiredName).boundingBox()
      const expiringSoonBox = await page.getByText(expiringSoonName).boundingBox()
      const validBox = await page.getByText(validName).boundingBox()

      expect(expiredBox).not.toBeNull()
      expect(expiringSoonBox).not.toBeNull()
      expect(validBox).not.toBeNull()

      expect(expiredBox!.y).toBeLessThan(expiringSoonBox!.y)
      expect(expiringSoonBox!.y).toBeLessThan(validBox!.y)
    } finally {
      await Promise.all([
        deleteCertificationIfExists(request, expiredCertId),
        deleteCertificationIfExists(request, expiringSoonCertId),
        deleteCertificationIfExists(request, validCertId),
      ])
      await deleteTechnicianIfExists(request, technicianId)
    }
  })
})
