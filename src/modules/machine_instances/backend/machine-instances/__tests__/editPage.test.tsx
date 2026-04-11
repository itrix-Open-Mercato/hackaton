/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import EditMachineInstancePage from '../[id]/page'

const mockFetchCrudList = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}))

jest.mock('@open-mercato/ui/backend/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@open-mercato/ui/backend/CrudForm', () => ({
  CrudForm: ({ initialValues, isLoading }: { initialValues: unknown; isLoading: boolean }) =>
    isLoading ? (
      <div data-testid="loading">Loading...</div>
    ) : (
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

describe('EditMachineInstancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads and maps camelCase API response (ORM fallback path)', async () => {
    mockFetchCrudList.mockResolvedValue({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          instanceCode: 'RES-00041',
          serialNumber: 'PM6000-2021-001',
          catalogProductId: '22222222-2222-4222-8222-222222222222',
          customerCompanyId: '33333333-3333-4333-8333-333333333333',
          siteName: 'Fabryka Części',
          locationLabel: 'Hala B, stanowisko 4',
          contactName: 'Jan Kowalski',
          contactPhone: '+48 601 222 333',
          manufacturedAt: '2021-03-15',
          commissionedAt: '2021-05-08',
          warrantyUntil: '2024-05-08',
          warrantyStatus: 'expired',
          lastInspectionAt: '2025-11-20',
          nextInspectionAt: '2026-05-20',
          requiresAnnouncement: true,
          announcementLeadTimeHours: 48,
          instanceNotes: 'Dostęp przez bramę B, ochrona.',
          isActive: true,
        },
      ],
    })

    render(<EditMachineInstancePage params={{ id: '11111111-1111-4111-8111-111111111111' }} />)

    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenCalledWith('machine_instances/machines', {
        ids: '11111111-1111-4111-8111-111111111111',
        pageSize: 1,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('crud-form')).toBeInTheDocument()
    })

    const form = screen.getByTestId('crud-form')
    expect(form).toHaveTextContent('"instanceCode":"RES-00041"')
    expect(form).toHaveTextContent('"serialNumber":"PM6000-2021-001"')
    expect(form).toHaveTextContent('"siteName":"Fabryka Części"')
    expect(form).toHaveTextContent('"contactName":"Jan Kowalski"')
    expect(form).toHaveTextContent('"warrantyStatus":"expired"')
    expect(form).toHaveTextContent('"requiresAnnouncement":true')
    expect(form).toHaveTextContent('"announcementLeadTimeHours":48')
    expect(form).toHaveTextContent('"isActive":true')
  })

  it('loads and maps snake_case API response (query engine path)', async () => {
    mockFetchCrudList.mockResolvedValue({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          instance_code: 'RES-00089',
          serial_number: 'TM25-2022-003',
          catalog_product_id: 'aaaa-bbbb',
          customer_company_id: 'cccc-dddd',
          site_name: 'Zakład Główny',
          location_label: 'Parter',
          contact_name: 'Anna Nowak',
          contact_phone: '+48 500 100 200',
          manufactured_at: '2022-06-01',
          commissioned_at: '2022-07-15',
          warranty_until: '2025-07-15',
          warranty_status: 'active',
          last_inspection_at: '2025-12-01',
          next_inspection_at: '2026-06-01',
          requires_announcement: false,
          announcement_lead_time_hours: 24,
          instance_notes: 'Note',
          is_active: false,
        },
      ],
    })

    render(<EditMachineInstancePage params={{ id: '11111111-1111-4111-8111-111111111111' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('crud-form')).toBeInTheDocument()
    })

    const form = screen.getByTestId('crud-form')
    expect(form).toHaveTextContent('"instanceCode":"RES-00089"')
    expect(form).toHaveTextContent('"serialNumber":"TM25-2022-003"')
    expect(form).toHaveTextContent('"siteName":"Zakład Główny"')
    expect(form).toHaveTextContent('"warrantyStatus":"active"')
    expect(form).toHaveTextContent('"requiresAnnouncement":false')
    expect(form).toHaveTextContent('"isActive":false')
  })

  it('shows error when machine instance is not found', async () => {
    mockFetchCrudList.mockResolvedValue({ items: [] })

    render(<EditMachineInstancePage params={{ id: 'nonexistent' }} />)

    await waitFor(() => {
      expect(screen.getByText('Machine instance not found.')).toBeInTheDocument()
    })
  })

  it('returns null when no id param is provided', () => {
    const { container } = render(<EditMachineInstancePage params={{}} />)
    expect(container.innerHTML).toBe('')
  })
})
