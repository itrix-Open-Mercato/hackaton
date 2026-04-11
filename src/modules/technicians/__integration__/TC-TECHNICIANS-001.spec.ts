import { expect, test } from '@playwright/test'

test.describe('TC-TECHNICIANS-001: technician CRUD lifecycle', () => {
  test('creates a technician, adds skills and certifications, queries by skill, updates, and deletes', async ({ request }) => {
    test.setTimeout(60_000)

    const { getAuthToken, apiRequest } = await import('@open-mercato/core/helpers/integration/api')
    const token = await getAuthToken(request, 'admin')

    const staffMemberId = crypto.randomUUID()
    let technicianId: string | null = null

    try {
      // 1. Create technician with skills and certifications
      const createRes = await apiRequest(request, 'POST', '/api/technicians/technicians', {
        token,
        data: {
          staff_member_id: staffMemberId,
          is_active: true,
          notes: 'Integration test technician',
          skills: ['Electrical', 'HVAC'],
          certifications: [
            { name: 'ISO 9001', certificate_number: 'TEST-001', expires_at: '2027-12-31' },
          ],
        },
      })

      expect(createRes.ok(), `create failed: ${createRes.status()}`).toBeTruthy()
      const createBody = (await createRes.json()) as { id: string }
      technicianId = createBody.id
      expect(typeof technicianId).toBe('string')

      // 2. List technicians — verify created technician appears
      const listRes = await apiRequest(request, 'GET', '/api/technicians/technicians?is_active=true', { token })
      expect(listRes.ok()).toBeTruthy()
      const listBody = (await listRes.json()) as { items: Array<{ id: string; staffMemberId: string; skills: string[] }> }
      const found = listBody.items.find((t) => t.id === technicianId)
      expect(found).toBeDefined()
      expect(found!.staffMemberId).toBe(staffMemberId)
      expect(found!.skills).toContain('Electrical')
      expect(found!.skills).toContain('HVAC')

      // 3. List skills for the technician
      const skillsRes = await apiRequest(request, 'GET', `/api/technicians/technicians/${technicianId}/skills`, { token })
      expect(skillsRes.ok()).toBeTruthy()
      const skillsBody = (await skillsRes.json()) as { items: Array<{ id: string; name: string }> }
      expect(skillsBody.items).toHaveLength(2)
      const skillNames = skillsBody.items.map((s) => s.name).sort()
      expect(skillNames).toEqual(['Electrical', 'HVAC'])

      // 4. List certifications for the technician
      const certsRes = await apiRequest(request, 'GET', `/api/technicians/technicians/${technicianId}/certifications`, { token })
      expect(certsRes.ok()).toBeTruthy()
      const certsBody = (await certsRes.json()) as { items: Array<{ id: string; name: string; certificateNumber: string | null; isExpired: boolean }> }
      expect(certsBody.items).toHaveLength(1)
      expect(certsBody.items[0].name).toBe('ISO 9001')
      expect(certsBody.items[0].certificateNumber).toBe('TEST-001')
      expect(certsBody.items[0].isExpired).toBe(false)

      // 5. Add another skill
      const addSkillRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${technicianId}/skills`, {
        token,
        data: { name: 'Plumbing' },
      })
      expect(addSkillRes.status()).toBe(201)

      // 6. Verify skill filter works
      const filteredRes = await apiRequest(request, 'GET', '/api/technicians/technicians?skill=Plumbing', { token })
      expect(filteredRes.ok()).toBeTruthy()
      const filteredBody = (await filteredRes.json()) as { items: Array<{ id: string }> }
      const filteredFound = filteredBody.items.find((t) => t.id === technicianId)
      expect(filteredFound).toBeDefined()

      // 7. Verify skill filter excludes non-matching
      const noMatchRes = await apiRequest(request, 'GET', '/api/technicians/technicians?skill=NonExistentSkill', { token })
      expect(noMatchRes.ok()).toBeTruthy()
      const noMatchBody = (await noMatchRes.json()) as { items: Array<{ id: string }> }
      const noMatchFound = noMatchBody.items.find((t) => t.id === technicianId)
      expect(noMatchFound).toBeUndefined()

      // 8. Remove a skill
      const skillToRemove = skillsBody.items.find((s) => s.name === 'HVAC')!
      const removeSkillRes = await apiRequest(request, 'DELETE', `/api/technicians/technicians/${technicianId}/skills?id=${skillToRemove.id}`, { token })
      expect(removeSkillRes.ok()).toBeTruthy()

      // 9. Update technician
      const updateRes = await apiRequest(request, 'PUT', '/api/technicians/technicians', {
        token,
        data: { id: technicianId, is_active: false, notes: 'Updated notes' },
      })
      expect(updateRes.ok()).toBeTruthy()

      // 10. Verify inactive filter excludes updated technician
      const activeOnlyRes = await apiRequest(request, 'GET', '/api/technicians/technicians?is_active=true', { token })
      expect(activeOnlyRes.ok()).toBeTruthy()
      const activeBody = (await activeOnlyRes.json()) as { items: Array<{ id: string }> }
      const shouldBeGone = activeBody.items.find((t) => t.id === technicianId)
      expect(shouldBeGone).toBeUndefined()

      // 11. Prevent duplicate profile for same staff member
      const dupeRes = await apiRequest(request, 'POST', '/api/technicians/technicians', {
        token,
        data: { staff_member_id: staffMemberId },
      })
      expect(dupeRes.status()).toBe(409)

    } finally {
      // Cleanup: delete technician
      if (technicianId) {
        const deleteRes = await apiRequest(request, 'DELETE', `/api/technicians/technicians?id=${technicianId}`, { token })
        expect(deleteRes.ok(), `cleanup delete failed: ${deleteRes.status()}`).toBeTruthy()
      }
    }
  })
})
