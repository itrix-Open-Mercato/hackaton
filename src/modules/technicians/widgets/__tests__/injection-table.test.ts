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

  it('has sidebar menu spot', () => {
    expect(injectionTable).toHaveProperty('menu:sidebar:main')
    const entry = (injectionTable as Record<string, any>)['menu:sidebar:main']
    expect(entry.widgetId).toBe('technicians.injection.TechnicianMenuItem')
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
