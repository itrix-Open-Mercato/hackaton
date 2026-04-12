/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import TechnicianSchedulePage from '../technician-schedule/page'

const mockUseQuery = jest.fn()
const mockInvalidateQueries = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (_key: string, fallback?: string) => fallback ?? _key,
}))

jest.mock('@open-mercato/shared/lib/frontend/useOrganizationScope', () => ({
  useOrganizationScopeVersion: () => 'scope-1',
}))

jest.mock('@open-mercato/ui/backend/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div>,
}))

jest.mock('@open-mercato/ui/backend/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}))

jest.mock('@open-mercato/ui/backend/detail', () => ({
  ErrorMessage: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingMessage: ({ label }: { label: string }) => <div>{label}</div>,
}))

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCallOrThrow: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/FlashMessages', () => ({
  flash: jest.fn(),
}))

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button {...props}>{children}</button>,
}))

jest.mock('@open-mercato/ui/primitives/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

jest.mock('@open-mercato/ui/primitives/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@open-mercato/ui/backend/confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialogElement: null,
  }),
}))

jest.mock('@open-mercato/ui/backend/schedule', () => ({
  ScheduleView: ({ items, onItemClick }: { items: Array<{ metadata?: { reservation?: unknown } }>; onItemClick: (item: { metadata?: { reservation?: unknown } }) => void }) => (
    <button type="button" onClick={() => onItemClick(items[0])}>Open reservation</button>
  ),
}))

describe('technician schedule ticket source', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'technician-schedule-technicians') {
        return {
          data: {
            items: [{ id: 'tech-1', display_name: 'Jane Doe' }],
          },
          isLoading: false,
        }
      }

      if (queryKey[0] === 'technician-schedule-reservations') {
        return {
          data: {
            items: [{
              id: 'res-1',
              title: 'Service ticket SRV-000001',
              reservation_type: 'client_visit',
              status: 'auto_confirmed',
              source_type: 'service_ticket',
              source_ticket_id: 'ticket-1',
              source_order_id: null,
              starts_at: '2026-04-12T09:00:00.000Z',
              ends_at: '2026-04-12T10:00:00.000Z',
              vehicle_id: null,
              vehicle_label: null,
              customer_name: 'Acme',
              address: 'Main Street',
              notes: null,
              technicians: ['tech-1'],
              technician_names: ['Jane Doe'],
            }],
            totalCount: 1,
            page: 1,
            pageSize: 100,
          },
          isLoading: false,
        }
      }

      return { data: null, isLoading: false }
    })
  })

  it('links reservation details back to the service ticket source', () => {
    render(<TechnicianSchedulePage />)

    fireEvent.click(screen.getByText('Open reservation'))

    expect(screen.getByText('ticket-1')).toHaveAttribute('href', '/backend/service-tickets/ticket-1/edit')
  })
})
