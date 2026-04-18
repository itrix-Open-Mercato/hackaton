/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditTechnicianPage from '../technicians/[id]/edit/page'

const mockUseQuery = jest.fn()
const mockFetch = jest.fn()

Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
})

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (_key: string, fallback?: string) => fallback ?? _key,
}))

jest.mock('@open-mercato/ui/backend/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@open-mercato/ui/backend/detail', () => ({
  ErrorMessage: ({ label }: { label: string }) => <div>{label}</div>,
}))

jest.mock('@open-mercato/ui/backend/utils/crud', () => ({
  deleteCrud: jest.fn(),
  fetchCrudList: jest.fn(),
  updateCrud: jest.fn(),
  createCrud: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/utils/flash', () => ({
  pushWithFlash: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/FlashMessages', () => ({
  flash: jest.fn(),
}))

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button {...props}>{children}</button>,
}))

jest.mock('@open-mercato/ui/primitives/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@open-mercato/ui/backend/forms', () => ({
  FormHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../components/StaffMemberSelect', () => () => <div>StaffMemberSelect</div>)

function setupQueries(
  availabilityItems: Array<{ id: string; technician_id: string; date: string; day_type: 'trip' | 'unavailable' | 'holiday'; notes: string | null }>,
  reservationItems: Array<{ id: string; title: string; starts_at: string; ends_at: string; source_ticket_id: string | null; source_order_id: string | null }> = [],
) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'technician-detail') {
      return {
        data: {
          items: [{
            id: 'tech-1',
            staffMemberId: 'staff-1',
            staffMemberName: 'Jane Doe',
            isActive: true,
            notes: null,
            skills: [],
            skillItems: [],
            certificationCount: 0,
            certifications: [],
          }],
        },
        isLoading: false,
        refetch: jest.fn(),
      }
    }

    if (queryKey[0] === 'technician-availability') {
      return {
        data: { items: availabilityItems },
        isLoading: false,
        refetch: jest.fn(),
      }
    }

    if (queryKey[0] === 'technician-reservation-overlays') {
      return {
        data: { items: reservationItems },
        isLoading: false,
        refetch: jest.fn(),
      }
    }

    return { data: null, isLoading: false, refetch: jest.fn() }
  })
}

describe('technician edit availability tab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(new Date('2026-04-12T12:00:00.000Z'))
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('creates a reservation-backed trip marker when a blank day is clicked', async () => {
    setupQueries([])

    render(<EditTechnicianPage params={{ id: 'tech-1' }} />)

    fireEvent.click(screen.getByText('Availability'))
    fireEvent.click(screen.getAllByTitle('No marking')[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/technicians/technicians/tech-1/availability'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
    })
    expect(mockFetch.mock.calls[0][1].body).toContain('"day_type":"trip"')
  })

  it('clears an explicit availability marker back to implicit work day', async () => {
    setupQueries([
      { id: 'avail-1', technician_id: 'tech-1', date: '2026-04-01', day_type: 'holiday', notes: null },
    ])

    render(<EditTechnicianPage params={{ id: 'tech-1' }} />)

    fireEvent.click(screen.getByText('Availability'))
    fireEvent.click(screen.getByRole('button', { name: '1' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/technicians/technicians/tech-1/availability?id=avail-1'),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        }),
      )
    })
  })

  it('shows reservation overlays on availability days from the shared reservation source', () => {
    setupQueries([], [
      {
        id: 'res-1',
        title: 'Service ticket SRV-000002',
        starts_at: '2026-04-15T09:00:00.000Z',
        ends_at: '2026-04-15T10:00:00.000Z',
        source_ticket_id: 'ticket-1',
        source_order_id: null,
      },
    ])

    render(<EditTechnicianPage params={{ id: 'tech-1' }} />)

    fireEvent.click(screen.getByText('Availability'))

    expect(screen.getByText('1 reservation')).toBeInTheDocument()
    expect(screen.getByText('Service ticket SRV-000002')).toBeInTheDocument()
    expect(screen.getByTitle(/Service ticket SRV-000002/)).toBeInTheDocument()
  })
})
