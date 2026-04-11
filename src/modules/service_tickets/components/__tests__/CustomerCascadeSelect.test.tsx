/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CustomerCascadeSelect from '../CustomerCascadeSelect'

const mockFetchCompanyById = jest.fn()
const mockFetchCompanyPeople = jest.fn()
const mockFetchPersonById = jest.fn()
const mockSearchCompanies = jest.fn()

jest.mock('@open-mercato/ui/primitives/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

jest.mock('@open-mercato/ui/backend/inputs/ComboboxInput', () => {
  const React = require('react') as typeof import('react')

  function MockComboboxInput({
    value,
    onChange,
    resolveLabel,
    placeholder,
    disabled,
  }: {
    value: string
    onChange: (next: string) => void
    resolveLabel?: (next: string) => string
    placeholder?: string
    disabled?: boolean
  }) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [input, setInput] = React.useState(value ? resolveLabel?.(value) ?? value : '')

    React.useEffect(() => {
      if (globalThis.document?.activeElement !== inputRef.current) {
        setInput(value ? resolveLabel?.(value) ?? value : '')
      }
    }, [resolveLabel, value])

    return (
      <input
        ref={inputRef}
        value={input}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setInput(event.target.value)}
        onBlur={() => onChange(input)}
      />
    )
  }

  return { ComboboxInput: MockComboboxInput }
})

jest.mock('../customerOptions', () => ({
  fetchCompanyById: (...args: unknown[]) => mockFetchCompanyById(...args),
  fetchCompanyPeople: (...args: unknown[]) => mockFetchCompanyPeople(...args),
  fetchPersonById: (...args: unknown[]) => mockFetchPersonById(...args),
  searchCompanies: (...args: unknown[]) => mockSearchCompanies(...args),
  mergeEntityOptions: (existing: Array<{ value: string; label: string }>, next: Array<{ value: string; label: string }>) => {
    const merged = new Map(existing.map((option) => [option.value, option]))
    for (const option of next) {
      merged.set(option.value, option)
    }
    return Array.from(merged.values())
  },
}))

describe('CustomerCascadeSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchCompanyById.mockResolvedValue({ value: 'company-1', label: 'Acme Industries' })
    mockFetchCompanyPeople.mockResolvedValue([{ value: 'person-1', label: 'Alice Doe' }])
    mockFetchPersonById.mockResolvedValue({ value: 'person-1', label: 'Alice Doe' })
    mockSearchCompanies.mockResolvedValue([])
  })

  it('hydrates focused company and contact inputs from stored ids', async () => {
    const setCompanyId = jest.fn()
    const setPersonId = jest.fn()

    render(
      <CustomerCascadeSelect
        companyId="company-1"
        personId="person-1"
        companyLabel="Company"
        personLabel="Contact"
        companyPlaceholder="Search companies"
        personPlaceholder="Search contacts"
        setCompanyId={setCompanyId}
        setPersonId={setPersonId}
      />,
    )

    const companyInput = screen.getByTestId('service-ticket-company-field').querySelector('input')
    const personInput = screen.getByTestId('service-ticket-contact-field').querySelector('input')

    expect(companyInput).not.toBeNull()
    expect(personInput).not.toBeNull()

    fireEvent.focus(companyInput as HTMLInputElement)

    await waitFor(() => {
      expect(mockFetchCompanyById).toHaveBeenCalledWith('company-1')
      expect(mockFetchCompanyPeople).toHaveBeenCalledWith('company-1')
      expect(mockFetchPersonById).toHaveBeenCalledWith('person-1')
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Industries')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Alice Doe')).toBeInTheDocument()
    })
  })

  it('clears the selected contact when the company changes', async () => {
    const setCompanyId = jest.fn()
    const setPersonId = jest.fn()

    render(
      <CustomerCascadeSelect
        companyId="company-1"
        personId="person-1"
        companyLabel="Company"
        personLabel="Contact"
        companyPlaceholder="Search companies"
        personPlaceholder="Search contacts"
        setCompanyId={setCompanyId}
        setPersonId={setPersonId}
      />,
    )

    const companyInput = screen.getByTestId('service-ticket-company-field').querySelector('input')

    expect(companyInput).not.toBeNull()

    fireEvent.change(companyInput as HTMLInputElement, { target: { value: 'New Company' } })
    fireEvent.blur(companyInput as HTMLInputElement)

    await waitFor(() => {
      expect(setCompanyId).toHaveBeenCalledWith('New Company')
      expect(setPersonId).toHaveBeenCalledWith('')
    })
  })
})
