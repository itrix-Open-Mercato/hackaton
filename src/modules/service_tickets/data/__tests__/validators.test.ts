/**
 * @jest-environment node
 */
import { ticketCreateSchema, ticketUpdateSchema } from '../validators'

const UUID_1 = '11111111-1111-4111-8111-111111111111'
const UUID_2 = '22222222-2222-4222-8222-222222222222'

describe('service ticket validators', () => {
  it('rejects duplicate staff member ids on create', () => {
    expect(() =>
      ticketCreateSchema.parse({
        service_type: 'regular',
        staff_member_ids: [UUID_1, UUID_1],
      }),
    ).toThrow('Duplicate staff member IDs are not allowed')
  })

  it('accepts unique staff member ids on update', () => {
    expect(
      ticketUpdateSchema.parse({
        id: UUID_1,
        staff_member_ids: [UUID_1, UUID_2],
      }).staff_member_ids,
    ).toEqual([UUID_1, UUID_2])
  })

  it('accepts ISO 8601 and datetime-local tokens', () => {
    expect(
      ticketCreateSchema.parse({
        service_type: 'maintenance',
        visit_date: '2026-04-15T09:00:00.000Z',
      }).visit_date,
    ).toBe('2026-04-15T09:00:00.000Z')

    expect(
      ticketCreateSchema.parse({
        service_type: 'maintenance',
        visit_date: '2026-04-15T09:00',
      }).visit_date,
    ).toBe('2026-04-15T09:00')
  })

  it('rejects arbitrary datetime strings and keeps empty strings optional', () => {
    expect(() =>
      ticketCreateSchema.parse({
        service_type: 'maintenance',
        visit_date: 'next tuesday',
      }),
    ).toThrow('Expected an ISO 8601 datetime string')

    expect(
      ticketCreateSchema.parse({
        service_type: 'maintenance',
        visit_date: '',
      }).visit_date,
    ).toBeUndefined()
  })
})
