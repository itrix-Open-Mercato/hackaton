import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineProfile,
  createPartTemplate,
  createPartTemplateInput,
  createProfileInput,
  deleteMachineProfile,
  deletePartTemplate,
  listMachineProfiles,
  listPartTemplates,
  updateMachineProfile,
} from './helpers/fixtures'

test.describe('TC-MCAT-002: Part templates CRUD', () => {
  test('creates a part template and returns it in the list filtered by profileId', async ({ request }) => {
    const token = getCachedToken()
    let profileId: string | null = null
    let templateId: string | null = null

    try {
      profileId = await createMachineProfile(request, token, createProfileInput())

      const input = createPartTemplateInput(profileId)
      templateId = await createPartTemplate(request, token, input)

      const list = await listPartTemplates(request, token, `machineProfileId=${profileId}`)
      const created = list.items.find((item) => item['id'] === templateId)

      expect(created).toBeTruthy()
      expect(created?.['partName']).toBe(input.partName)
      expect(created?.['templateType']).toBe(input.templateType)
      expect(created?.['serviceContext']).toBe(input.serviceContext)
      expect(created?.['machineProfileId']).toBe(profileId)
    } finally {
      if (templateId) await deletePartTemplate(request, token, templateId)
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })

  test('searches part templates by part name', async ({ request }) => {
    const token = getCachedToken()
    let profileId: string | null = null
    let templateId: string | null = null

    try {
      profileId = await createMachineProfile(request, token, createProfileInput())
      const input = createPartTemplateInput(profileId)
      templateId = await createPartTemplate(request, token, input)

      const list = await listPartTemplates(request, token, `search=${encodeURIComponent(input.partName)}`)
      expect(list.items.some((item) => item['id'] === templateId)).toBeTruthy()
    } finally {
      if (templateId) await deletePartTemplate(request, token, templateId)
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })
})

test.describe('TC-MCAT-003: Update machine catalog profile', () => {
  test('updates profile fields and reflects changes in list', async ({ request }) => {
    const token = getCachedToken()
    let profileId: string | null = null

    try {
      profileId = await createMachineProfile(request, token, createProfileInput())

      const response = await updateMachineProfile(request, token, profileId, {
        defaultTeamSize: 5,
        serviceNotes: 'Updated QA service notes',
        isActive: false,
      })
      expect(response.ok(), `Update failed: ${response.status()}`).toBeTruthy()

      const list = await listMachineProfiles(request, token, `ids=${profileId}`)
      const updated = list.items.find((item) => item['id'] === profileId)

      expect(updated).toBeTruthy()
      expect(updated?.['defaultTeamSize']).toBe(5)
      expect(updated?.['serviceNotes']).toBe('Updated QA service notes')
      expect(updated?.['isActive']).toBe(false)
    } finally {
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })
})
