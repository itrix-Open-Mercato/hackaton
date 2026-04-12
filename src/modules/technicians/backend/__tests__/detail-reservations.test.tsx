/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import TechnicianDetailPage from '../technicians/[id]/page'

const mockUseQuery = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
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
  fetchCrudList: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCallOrThrow: jest.fn(),
}))

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('technician detail reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
        }
      }

      if (queryKey[0] === 'technician-detail-reservations') {
        return {
          data: {
            items: [{
              id: 'res-1',
              title: 'Service ticket SRV-000001',
              starts_at: '2026-04-12T09:00:00.000Z',
              ends_at: '2026-04-12T10:00:00.000Z',
              status: 'auto_confirmed',
              source_type: 'service_ticket',
              source_ticket_id: 'ticket-1',
            }],
          },
          isLoading: false,
        }
      }

      return { data: null, isLoading: false }
    })
  })

  it('renders unified reservation data with a ticket link', () => {
    render(<TechnicianDetailPage params={{ id: 'tech-1' }} />)

    expect(screen.getByText('Upcoming reservations')).toBeInTheDocument()
    expect(screen.getByText('Service ticket SRV-000001')).toBeInTheDocument()
    expect(screen.getByText('Open ticket')).toHaveAttribute('href', '/backend/service-tickets/ticket-1/edit')
  })
})
