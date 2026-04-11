/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import EditMachineProfilePage from '../[id]/page'

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

describe('EditMachineProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads and maps camelCase API response (ORM fallback path)', async () => {
    mockFetchCrudList.mockResolvedValue({
      items: [
        {
          id: 'aaaa-bbbb-cccc-dddd',
          catalogProductId: 'd3e52676-d024-4755-963e-c869ec948c40',
          machineFamily: 'HVAC – Pompy ciepła',
          modelCode: 'PRD-HP-TM25',
          defaultTeamSize: 1,
          defaultServiceDurationMinutes: 180,
          preventiveMaintenanceIntervalDays: 365,
          defaultWarrantyMonths: 36,
          startupNotes: 'Confirm hydraulic circuit',
          serviceNotes: 'Annual F-GAZ check',
          isActive: true,
        },
      ],
    })

    render(<EditMachineProfilePage params={{ id: 'aaaa-bbbb-cccc-dddd' }} />)

    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenCalledWith('machine_catalog/machine-profiles', {
        ids: 'aaaa-bbbb-cccc-dddd',
        pageSize: 1,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('crud-form')).toBeInTheDocument()
    })

    const form = screen.getByTestId('crud-form')
    expect(form).toHaveTextContent('"machineFamily":"HVAC – Pompy ciepła"')
    expect(form).toHaveTextContent('"modelCode":"PRD-HP-TM25"')
    expect(form).toHaveTextContent('"defaultTeamSize":1')
    expect(form).toHaveTextContent('"defaultServiceDurationMinutes":180')
    expect(form).toHaveTextContent('"preventiveMaintenanceIntervalDays":365')
    expect(form).toHaveTextContent('"defaultWarrantyMonths":36')
    expect(form).toHaveTextContent('"startupNotes":"Confirm hydraulic circuit"')
    expect(form).toHaveTextContent('"serviceNotes":"Annual F-GAZ check"')
    expect(form).toHaveTextContent('"isActive":true')
  })

  it('loads and maps snake_case API response (query engine path)', async () => {
    mockFetchCrudList.mockResolvedValue({
      items: [
        {
          id: 'aaaa-bbbb-cccc-dddd',
          catalog_product_id: 'prod-uuid',
          machine_family: 'Obrabiarki CNC',
          model_code: 'PRD-CNC-6000',
          default_team_size: 2,
          default_service_duration_minutes: 120,
          preventive_maintenance_interval_days: 180,
          default_warranty_months: 24,
          startup_notes: 'Calibrate axes',
          service_notes: 'Check lubrication',
          is_active: false,
        },
      ],
    })

    render(<EditMachineProfilePage params={{ id: 'aaaa-bbbb-cccc-dddd' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('crud-form')).toBeInTheDocument()
    })

    const form = screen.getByTestId('crud-form')
    expect(form).toHaveTextContent('"machineFamily":"Obrabiarki CNC"')
    expect(form).toHaveTextContent('"modelCode":"PRD-CNC-6000"')
    expect(form).toHaveTextContent('"defaultTeamSize":2')
    expect(form).toHaveTextContent('"defaultServiceDurationMinutes":120')
    expect(form).toHaveTextContent('"defaultWarrantyMonths":24')
    expect(form).toHaveTextContent('"startupNotes":"Calibrate axes"')
    expect(form).toHaveTextContent('"isActive":false')
  })

  it('shows error when machine profile is not found', async () => {
    mockFetchCrudList.mockResolvedValue({ items: [] })

    render(<EditMachineProfilePage params={{ id: 'nonexistent' }} />)

    await waitFor(() => {
      expect(screen.getByText('Machine profile not found.')).toBeInTheDocument()
    })
  })

  it('returns null when no id param is provided', () => {
    const { container } = render(<EditMachineProfilePage params={{}} />)
    expect(container.innerHTML).toBe('')
  })
})
