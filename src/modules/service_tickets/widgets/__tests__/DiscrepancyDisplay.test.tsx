/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { DiscrepancyDisplay } from '../injection/DiscrepancyDisplay'

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
}), { virtual: true })

describe('DiscrepancyDisplay', () => {
  // 14.1 Renders unknown_contact warning
  it('renders unknown_contact warning', () => {
    render(
      <DiscrepancyDisplay
        discrepancies={[{ type: 'unknown_contact', message: 'No customer found for email: user@test.com' }]}
      />,
    )
    expect(screen.getByText(/Unknown sender/)).toBeTruthy()
    expect(screen.getByText(/No customer found/)).toBeTruthy()
  })

  // 14.2 Renders ambiguous_customer with candidate names
  it('renders ambiguous_customer warning with candidates', () => {
    render(
      <DiscrepancyDisplay
        discrepancies={[{ type: 'ambiguous_customer', message: 'Multiple customers match domain acme.com: Acme A, Acme B' }]}
      />,
    )
    expect(screen.getByText(/Ambiguous customer/)).toBeTruthy()
    expect(screen.getByText(/Acme A, Acme B/)).toBeTruthy()
  })

  // 14.3 Renders machine_not_found warning
  it('renders machine_not_found warning', () => {
    render(
      <DiscrepancyDisplay
        discrepancies={[{ type: 'machine_not_found', message: 'Could not match machine hints: CNC 6000' }]}
      />,
    )
    expect(screen.getByText(/Machine not found/)).toBeTruthy()
  })

  // 14.4 Renders multiple discrepancies simultaneously
  it('renders multiple discrepancies', () => {
    render(
      <DiscrepancyDisplay
        discrepancies={[
          { type: 'unknown_contact', message: 'Unknown sender' },
          { type: 'machine_not_found', message: 'No match' },
        ]}
      />,
    )
    expect(screen.getAllByTestId('alert-icon')).toHaveLength(2)
  })

  // 14.5 Renders nothing when _discrepancies is empty
  it('renders nothing for empty discrepancies', () => {
    const { container } = render(<DiscrepancyDisplay discrepancies={[]} />)
    expect(container.innerHTML).toBe('')
  })

  // 14.6 Renders nothing when _discrepancies is undefined
  it('renders nothing when undefined', () => {
    const { container } = render(<DiscrepancyDisplay discrepancies={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})
