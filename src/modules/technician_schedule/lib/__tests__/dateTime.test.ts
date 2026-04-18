import { normalizeDateTimeString, parseDateTimeValue, toIsoDateTimeString } from '../dateTime'

describe('technician schedule dateTime helpers', () => {
  it('normalizes postgres timestamps for browser parsing', () => {
    expect(normalizeDateTimeString('2026-04-09 07:00:00+00')).toBe('2026-04-09T07:00:00+00:00')
  })

  it('parses normalized postgres timestamps into valid dates', () => {
    const parsed = parseDateTimeValue('2026-04-09 07:00:00+00')
    expect(parsed).not.toBeNull()
    expect(parsed?.toISOString()).toBe('2026-04-09T07:00:00.000Z')
  })

  it('serializes string timestamps to ISO format', () => {
    expect(toIsoDateTimeString('2026-04-13 07:00:00+00')).toBe('2026-04-13T07:00:00.000Z')
  })
})
