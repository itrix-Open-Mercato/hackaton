/**
 * @jest-environment node
 */
import { injectionTable } from '../injection-table'

describe('technicians injection-table', () => {
  it('exports an object (not an array)', () => {
    expect(Array.isArray(injectionTable)).toBe(false)
    expect(typeof injectionTable).toBe('object')
    expect(injectionTable).not.toBeNull()
  })

  it('does not have sidebar menu spot (page.meta handles sidebar)', () => {
    expect(injectionTable).not.toHaveProperty('menu:sidebar:main')
  })

  it('has service ticket crud-form spot', () => {
    const table = injectionTable as Record<string, any>
    const spotKey = 'crud-form:service_tickets.service_ticket'
    expect(table[spotKey]).toBeDefined()
    expect(table[spotKey].widgetId).toBe('technicians.injection.TechnicianPicker')
  })

  it('exports both named and default export', async () => {
    const mod = await import('../injection-table')
    expect(mod.injectionTable).toBeDefined()
    expect(mod.default).toBeDefined()
    expect(mod.injectionTable).toBe(mod.default)
  })
})
