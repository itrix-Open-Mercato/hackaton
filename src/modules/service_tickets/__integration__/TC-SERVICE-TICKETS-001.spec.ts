import { expect, test } from '@playwright/test'

async function dismissMarketingModal(page: import('@playwright/test').Page): Promise<void> {
  const heading = page.getByRole('heading', { name: /Talk to Open Mercato team/i }).first()
  if (!(await heading.isVisible().catch(() => false))) return

  const dialog = heading.locator('xpath=ancestor::div[@role="dialog" or @data-slot="dialog-content"]').first()
  const closeButton = dialog.locator('button').first()
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  }
}

async function suppressMarketingModal(page: import('@playwright/test').Page): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  await page.context().addCookies([
    {
      name: 'om_feedback_suppress',
      value: '1',
      url: baseUrl,
      sameSite: 'Lax',
    },
  ])
}

async function createTicket(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const { apiRequest } = await import('@open-mercato/core/helpers/integration/api')
  const response = await apiRequest(request, 'POST', '/api/service_tickets/tickets', { token, data: payload })
  const body = (await response.json()) as { id?: string }

  expect(response.ok(), `ticket create failed: ${response.status()}`).toBeTruthy()
  expect(typeof body.id).toBe('string')

  return String(body.id)
}

test.describe('TC-SERVICE-TICKETS-001: service ticket customer linkage', () => {
  test('creates a ticket with company/contact linkage and reloads it in the edit form', async ({ page, request }) => {
    test.setTimeout(60_000)

    const { login } = await import('@open-mercato/core/helpers/integration/auth')
    const { getAuthToken, apiRequest } = await import('@open-mercato/core/helpers/integration/api')
    const {
      createCompanyFixture,
      createPersonFixture,
      deleteEntityIfExists,
    } = await import('@open-mercato/core/helpers/integration/crmFixtures')

      const token = await getAuthToken(request, 'admin')
    const stamp = Date.now()
    const companyName = `Service Ticket Company ${stamp}`
    const contactName = `Service Contact ${stamp}`

    let ticketId: string | null = null
    let companyId: string | null = null
    let personId: string | null = null

    try {
      companyId = await createCompanyFixture(request, token, companyName)
      personId = await createPersonFixture(request, token, {
        firstName: 'Service',
        lastName: `Contact ${stamp}`,
        displayName: contactName,
        companyEntityId: companyId,
      })

      ticketId = await createTicket(request, token, {
        service_type: 'maintenance',
        customer_entity_id: companyId,
        contact_person_id: personId,
        description: `Playwright ticket ${stamp}`,
      })

      const listResponse = await apiRequest(
        request,
        'GET',
        '/api/service_tickets/tickets?page=1&pageSize=20&sortField=createdAt&sortDir=desc',
        { token },
      )
      const listBody = (await listResponse.json()) as { items?: Array<Record<string, unknown>> }
      const created = (listBody.items ?? []).find(
        (item) =>
          item.customerEntityId === companyId &&
          item.contactPersonId === personId &&
          item.serviceType === 'maintenance',
      )

      expect(created).toBeDefined()

      await suppressMarketingModal(page)
      await login(page, 'admin')
      await page.goto(`/backend/service-tickets/${encodeURIComponent(ticketId)}/edit`, {
        waitUntil: 'domcontentloaded',
      })
      await dismissMarketingModal(page)

      await expect(page.getByTestId('service-ticket-company-field').locator('input').first()).toBeVisible()
      await expect(page.getByTestId('service-ticket-contact-field').locator('input').first()).toBeVisible()
      await expect
        .poll(async () => page.getByTestId('service-ticket-company-field').locator('input').first().inputValue())
        .toBe(companyName)
      await expect
        .poll(async () => page.getByTestId('service-ticket-contact-field').locator('input').first().inputValue())
        .toBe(contactName)
    } finally {
      await deleteEntityIfExists(request, token, '/api/service_tickets/tickets', ticketId)
      await deleteEntityIfExists(request, token, '/api/customers/people', personId)
      await deleteEntityIfExists(request, token, '/api/customers/companies', companyId)
    }
  })
})
