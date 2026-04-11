/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import EditServiceTicketPage from '../../backend/service-tickets/[id]/edit/page'

const mockFetchCrudList = jest.fn()
const mockMapTicketToFormValues = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('@open-mercato/ui/backend/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@open-mercato/ui/backend/detail', () => ({
  ErrorMessage: ({ label }: { label: string }) => <div data-testid="error-message">{label}</div>,
}))

jest.mock('@open-mercato/ui/backend/CrudForm', () => ({
  CrudForm: ({ initialValues }: { initialValues: unknown }) => (
    <div data-testid="crud-form">{JSON.stringify(initialValues)}</div>
  ),
}))

jest.mock('@open-mercato/ui/backend/utils/crud', () => ({
  fetchCrudList: (...args: unknown[]) => mockFetchCrudList(...args),
  updateCrud: jest.fn(),
  deleteCrud: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/utils/flash', () => ({
  pushWithFlash: jest.fn(),
}))

jest.mock('../ticketFormConfig', () => ({
  buildTicketFields: jest.fn(() => []),
  buildTicketGroups: jest.fn(() => []),
  createEmptyTicketFormValues: jest.fn(() => ({
    id: '',
    service_type: 'regular',
    status: 'new',
    priority: 'normal',
    description: '',
    visit_date: '',
    visit_end_date: '',
    address: '',
    latitude: '',
    longitude: '',
    customer_entity_id: '',
    contact_person_id: '',
    machine_instance_id: '',
    order_id: '',
    staff_member_ids: [],
  })),
  mapTicketToFormValues: (...args: unknown[]) => mockMapTicketToFormValues(...args),
}))

describe('service ticket edit page load', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads an existing ticket by id and hydrates the form without a not-found error', async () => {
    mockMapTicketToFormValues.mockReturnValue({
      id: '11111111-1111-4111-8111-111111111111',
      service_type: 'regular',
      status: 'scheduled',
      priority: 'normal',
      description: 'Loaded ticket',
      visit_date: '2026-04-15T11:00',
      visit_end_date: '2026-04-15T13:30',
      address: '123 Main St',
      latitude: '',
      longitude: '',
      customer_entity_id: '22222222-2222-4222-8222-222222222222',
      contact_person_id: '33333333-3333-4333-8333-333333333333',
      machine_instance_id: '44444444-4444-4444-8444-444444444444',
      order_id: '55555555-5555-4555-8555-555555555555',
      staff_member_ids: [
        '66666666-6666-4666-8666-666666666666',
        '77777777-7777-4777-8777-777777777777',
      ],
    })

    mockFetchCrudList.mockResolvedValue({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          ticketNumber: 'SRV-000001',
          serviceType: 'regular',
          status: 'scheduled',
          priority: 'normal',
          description: 'Loaded ticket',
          visitDate: '2026-04-15T09:00:00.000Z',
          visitEndDate: '2026-04-15T11:30:00.000Z',
          address: '123 Main St',
          customerEntityId: '22222222-2222-4222-8222-222222222222',
          contactPersonId: '33333333-3333-4333-8333-333333333333',
          machineInstanceId: '44444444-4444-4444-8444-444444444444',
          orderId: '55555555-5555-4555-8555-555555555555',
          staffMemberIds: [
            '66666666-6666-4666-8666-666666666666',
            '77777777-7777-4777-8777-777777777777',
          ],
        },
      ],
    })

    render(<EditServiceTicketPage params={{ id: '11111111-1111-4111-8111-111111111111' }} />)

    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenCalledWith('service_tickets/tickets', {
        id: '11111111-1111-4111-8111-111111111111',
        pageSize: 1,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('crud-form')).toHaveTextContent('"description":"Loaded ticket"')
    })

    expect(mockMapTicketToFormValues).toHaveBeenCalled()
    expect(screen.getByTestId('crud-form')).toHaveTextContent('"visit_date":"2026-04-15T11:00"')
    expect(screen.getByTestId('crud-form')).toHaveTextContent(
      '"staff_member_ids":["66666666-6666-4666-8666-666666666666","77777777-7777-4777-8777-777777777777"]',
    )
    expect(screen.queryByTestId('error-message')).toBeNull()
  })
})
