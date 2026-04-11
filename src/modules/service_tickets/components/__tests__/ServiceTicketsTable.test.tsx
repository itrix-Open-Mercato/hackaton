/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SortingState } from '@tanstack/react-table'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import type { ServiceTicketListItem } from '../../types'
import ServiceTicketsTable from '../ServiceTicketsTable'

type TicketsResponse = {
  items: ServiceTicketListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type UseQueryOptions = {
  queryKey: unknown[]
  queryFn: () => Promise<unknown>
}

type DataTableMockProps = {
  title: React.ReactNode
  actions?: React.ReactNode
  data?: ServiceTicketListItem[]
  isLoading?: boolean
  onSearchChange: (value: string) => void
  onFiltersApply: (values: FilterValues) => void
  onFiltersClear?: () => void
  onSortingChange: (sorting: SortingState) => void
  pagination: {
    onPageChange: (page: number) => void
  }
  rowActions: (row: ServiceTicketListItem) => React.ReactNode
  onRowClick?: (row: ServiceTicketListItem) => void
}

type RowActionItem = {
  id: string
  label: string
  href?: string
  onSelect?: () => Promise<void> | void
}

const mockUseQuery = jest.fn()
const mockInvalidateQueries = jest.fn()
const mockFetchCrudList = jest.fn()
const mockDeleteCrud = jest.fn()
const mockFlash = jest.fn()
const mockConfirm = jest.fn()
const mockPush = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: UseQueryOptions) => mockUseQuery(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

jest.mock('../customerOptions', () => ({
  searchCompanies: jest.fn().mockResolvedValue([]),
}))

jest.mock('@open-mercato/ui/backend/utils/crud', () => ({
  fetchCrudList: (...args: unknown[]) => mockFetchCrudList(...args),
  deleteCrud: (...args: unknown[]) => mockDeleteCrud(...args),
}))

jest.mock('@open-mercato/ui/backend/FlashMessages', () => ({
  flash: (...args: unknown[]) => mockFlash(...args),
}))

jest.mock('@open-mercato/ui/backend/DataTable', () => ({
  DataTable: (props: DataTableMockProps) => (
    <div data-testid="data-table">
      <h2>{props.title}</h2>
      <div data-testid="actions">{props.actions}</div>
      <button type="button" data-testid="search" onClick={() => props.onSearchChange('pump')}>
        search
      </button>
      <button
        type="button"
        data-testid="apply-filters"
        onClick={() => props.onFiltersApply({ status: ['scheduled', 'completed'], priority: ['urgent'] })}
      >
        apply filters
      </button>
      <button type="button" data-testid="clear-filters" onClick={() => props.onFiltersClear?.()}>
        clear filters
      </button>
      <button
        type="button"
        data-testid="sort-ticket-number"
        onClick={() => props.onSortingChange([{ id: 'ticketNumber', desc: false }])}
      >
        sort
      </button>
      <button type="button" data-testid="page-3" onClick={() => props.pagination.onPageChange(3)}>
        page 3
      </button>
      <button
        type="button"
        data-testid="open-row"
        onClick={() => props.data?.[0] && props.onRowClick?.(props.data[0])}
      >
        open row
      </button>
      <div data-testid="row-count">{props.data?.length ?? 0}</div>
      <div data-testid="row-actions">{props.data?.[0] ? props.rowActions(props.data[0]) : null}</div>
      {props.isLoading ? <div data-testid="loading">loading</div> : null}
    </div>
  ),
}))

jest.mock('@open-mercato/ui/backend/RowActions', () => ({
  RowActions: ({ items }: { items: RowActionItem[] }) => (
    <div>
      {items.map((item) =>
        item.href ? (
          <a key={item.id} href={item.href}>
            {item.label}
          </a>
        ) : (
          <button key={item.id} type="button" onClick={() => void item.onSelect?.()}>
            {item.label}
          </button>
        ),
      )}
    </div>
  ),
}))

jest.mock('@open-mercato/ui/backend/ValueIcons', () => ({
  EnumBadge: ({ value }: { value: string }) => <span>{value}</span>,
}))

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@open-mercato/shared/lib/frontend/useOrganizationScope', () => ({
  useOrganizationScopeVersion: () => 1,
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('@open-mercato/ui/backend/confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    ConfirmDialogElement: <div data-testid="confirm-dialog" />,
  }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const sampleRows: ServiceTicketListItem[] = [
  {
    id: 'ticket-1',
    ticketNumber: 'SRV-000001',
    serviceType: 'commissioning',
    status: 'new',
    priority: 'normal',
    visitDate: '2026-04-11T09:00:00.000Z',
    createdAt: '2026-04-10T08:00:00.000Z',
  },
]

function buildResponse(items: ServiceTicketListItem[] = sampleRows): TicketsResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 50,
    totalPages: items.length === 0 ? 0 : 1,
  }
}

describe('ServiceTicketsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchCrudList.mockResolvedValue(buildResponse())
    mockDeleteCrud.mockResolvedValue({ ok: true })
    mockConfirm.mockResolvedValue(true)
    mockUseQuery.mockImplementation(({ queryFn }: UseQueryOptions) => {
      void queryFn()
      return {
        data: buildResponse(),
        isLoading: false,
        error: null,
      }
    })
  })

  it('loads tickets with default params and renders navigation actions', async () => {
    render(<ServiceTicketsTable />)

    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '1',
          pageSize: '50',
          sortField: 'createdAt',
          sortDir: 'desc',
        }),
      )
    })

    expect(screen.getByText('service_tickets.table.title')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('1')
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    const createLink = screen.getByText('service_tickets.table.actions.create').closest('a')
    expect(createLink).toHaveAttribute('href', '/backend/service-tickets/create')

    const editLink = screen.getByText('service_tickets.table.actions.edit').closest('a')
    expect(editLink).toHaveAttribute('href', '/backend/service-tickets/ticket-1/edit')
  })

  it('rebuilds query params when pagination, filters, search, and sorting change', async () => {
    render(<ServiceTicketsTable />)

    fireEvent.click(screen.getByTestId('page-3'))
    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '3',
          pageSize: '50',
        }),
      )
    })

    fireEvent.click(screen.getByTestId('apply-filters'))
    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '1',
          status: 'scheduled,completed',
          priority: 'urgent',
        }),
      )
    })

    fireEvent.click(screen.getByTestId('search'))
    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '1',
          search: 'pump',
          status: 'scheduled,completed',
          priority: 'urgent',
        }),
      )
    })

    fireEvent.click(screen.getByTestId('sort-ticket-number'))
    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '1',
          sortField: 'ticketNumber',
          sortDir: 'asc',
        }),
      )
    })

    fireEvent.click(screen.getByTestId('clear-filters'))
    await waitFor(() => {
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.objectContaining({
          page: '1',
          pageSize: '50',
          sortField: 'ticketNumber',
          sortDir: 'asc',
        }),
      )
      expect(mockFetchCrudList).toHaveBeenLastCalledWith(
        'service_tickets/tickets',
        expect.not.objectContaining({
          search: 'pump',
          status: 'scheduled,completed',
          priority: 'urgent',
        }),
      )
    })
  })

  it('confirms deletion, removes the ticket, and invalidates the list query', async () => {
    render(<ServiceTicketsTable />)

    fireEvent.click(screen.getByText('service_tickets.table.actions.delete'))

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith({
        title: 'service_tickets.table.confirm.delete',
        variant: 'destructive',
      })
    })

    await waitFor(() => {
      expect(mockDeleteCrud).toHaveBeenCalledWith('service_tickets/tickets', 'ticket-1')
    })

    expect(mockFlash).toHaveBeenCalledWith('service_tickets.form.flash.deleted', 'success')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['service_tickets'] })
  })

  it('navigates to the edit view when a row is clicked', () => {
    render(<ServiceTicketsTable />)

    fireEvent.click(screen.getByTestId('open-row'))

    expect(mockPush).toHaveBeenCalledWith('/backend/service-tickets/ticket-1/edit')
  })

  it('renders the translated error state when the query fails', () => {
    mockUseQuery.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    }))

    render(<ServiceTicketsTable />)

    expect(screen.getByText('service_tickets.table.error.generic')).toBeInTheDocument()
  })
})
