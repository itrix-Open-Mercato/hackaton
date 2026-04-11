/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpenTicketFormButton } from '../injection/OpenTicketFormButton'

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}), { virtual: true })

jest.mock('lucide-react', () => ({
  FileText: () => <span data-testid="file-icon" />,
  AlertTriangle: () => <span data-testid="alert-icon" />,
}), { virtual: true })

const mockNavigate = jest.fn()

const baseProps = {
  actionId: 'act-123',
  proposalId: 'prop-456',
  actionType: 'create_service_ticket',
  payload: { description: 'Machine broken', _discrepancies: [] as any[] },
  onNavigate: mockNavigate,
}

describe('OpenTicketFormButton', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockNavigate.mockReset()
  })

  // 12.1 Clicking writes correct JSON to sessionStorage
  it('writes correct JSON to sessionStorage on click', () => {
    render(<OpenTicketFormButton {...baseProps} />)
    fireEvent.click(screen.getByText('Open Ticket Form'))
    const stored = JSON.parse(sessionStorage.getItem('inbox_ops.serviceTicketDraft')!)
    expect(stored.actionId).toBe('act-123')
    expect(stored.proposalId).toBe('prop-456')
    expect(stored.payload.description).toBe('Machine broken')
  })

  // 12.2 Clicking navigates to correct URL
  it('navigates to create page with fromInboxAction param', () => {
    render(<OpenTicketFormButton {...baseProps} />)
    fireEvent.click(screen.getByText('Open Ticket Form'))
    expect(mockNavigate).toHaveBeenCalledWith('/backend/service-tickets/create?fromInboxAction=act-123')
  })

  // 12.3 SessionStorage error is caught silently
  it('catches sessionStorage errors silently and still navigates', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    render(<OpenTicketFormButton {...baseProps} />)
    fireEvent.click(screen.getByText('Open Ticket Form'))
    expect(mockNavigate).toHaveBeenCalledWith('/backend/service-tickets/create?fromInboxAction=act-123')
    setItemSpy.mockRestore()
  })

  // 12.4 Button renders only for create_service_ticket
  it('renders nothing for other action types', () => {
    const { container } = render(
      <OpenTicketFormButton {...baseProps} actionType="create_order" />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the button for create_service_ticket', () => {
    render(<OpenTicketFormButton {...baseProps} />)
    expect(screen.getByText('Open Ticket Form')).toBeTruthy()
  })
})
