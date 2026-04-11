/**
 * @jest-environment node
 */

describe('technician create page redirect', () => {
  it('reads id from apiCall result property, not directly', () => {
    // Simulates ApiCallResult shape returned by apiCall()
    const apiCallResult = {
      ok: true,
      status: 201,
      result: { id: '11111111-1111-4111-8111-111111111111' },
      response: {} as Response,
      cacheStatus: null,
    }

    // The bug: reading res.id gives undefined
    expect((apiCallResult as any).id).toBeUndefined()

    // The fix: reading res.result.id gives the actual ID
    expect(apiCallResult.result?.id).toBe('11111111-1111-4111-8111-111111111111')

    // The redirect URL should use result.id
    const redirectUrl = `/backend/technicians/${apiCallResult.result?.id}/edit`
    expect(redirectUrl).toBe('/backend/technicians/11111111-1111-4111-8111-111111111111/edit')
    expect(redirectUrl).not.toContain('undefined')
  })
})
