/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MachineCascadeSelect from '../MachineCascadeSelect'

const mockFetchMachineById = jest.fn()
const mockFetchMachinePartTemplates = jest.fn()
const mockFetchMachineProfileByCatalogProductId = jest.fn()
const mockSearchMachines = jest.fn()

jest.mock('@open-mercato/ui/primitives/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}), { virtual: true })

jest.mock('@open-mercato/ui/backend/inputs/ComboboxInput', () => {
  const React = require('react') as typeof import('react')

  function MockComboboxInput({
    value,
    onChange,
    resolveLabel,
    placeholder,
  }: {
    value: string
    onChange: (next: string) => void
    resolveLabel?: (next: string) => string
    placeholder?: string
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
        onChange={(event) => setInput(event.target.value)}
        onBlur={() => onChange(input)}
      />
    )
  }

  return { ComboboxInput: MockComboboxInput }
}, { virtual: true })

jest.mock('../machineOptions', () => ({
  buildMachineLabel: (record: { instanceCode: string; serialNumber?: string | null; siteName?: string | null; locationLabel?: string | null }) =>
    [record.instanceCode, record.serialNumber, record.siteName, record.locationLabel].filter(Boolean).join(' • '),
  fetchMachineById: (...args: unknown[]) => mockFetchMachineById(...args),
  fetchMachineServiceTypes: (...args: unknown[]) => mockFetchMachinePartTemplates(...args),
  fetchMachineProfileByCatalogProductId: (...args: unknown[]) => mockFetchMachineProfileByCatalogProductId(...args),
  formatMachineAddress: (record: { siteName?: string | null; locationLabel?: string | null }) =>
    [record.siteName, record.locationLabel].filter(Boolean).join(' • ') || null,
  mergeMachineOptions: (
    existing: Array<{ value: string; label: string; record: unknown }>,
    next: Array<{ value: string; label: string; record: unknown }>,
  ) => {
    const merged = new Map(existing.map((option) => [option.value, option]))
    for (const option of next) {
      merged.set(option.value, option)
    }
    return Array.from(merged.values())
  },
  searchMachines: (...args: unknown[]) => mockSearchMachines(...args),
}))

const MESSAGES = {
  loading: 'Loading machine guidance...',
  profileTitle: 'Machine Guidance',
  emptyProfile: 'No profile',
  machineModelLabel: 'Machine model',
  locationLabel: 'Suggested location',
  maintenanceIntervalLabel: 'Preventive interval',
  serviceTypesTitle: 'Service Types',
  emptyServiceTypes: 'No service types',
}

describe('MachineCascadeSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchMachines.mockResolvedValue([
      {
        value: 'machine-1',
        label: 'MI-001 • SN-001 • Factory A',
        record: {
          id: 'machine-1',
          instanceCode: 'MI-001',
          serialNumber: 'SN-001',
          customerCompanyId: 'company-1',
          catalogProductId: 'catalog-1',
          siteName: 'Factory A',
          siteAddress: null,
          locationLabel: 'Hall B',
        },
      },
    ])
    mockFetchMachineById.mockResolvedValue({
      value: 'machine-1',
      label: 'MI-001 • SN-001 • Factory A',
      record: {
        id: 'machine-1',
        instanceCode: 'MI-001',
        serialNumber: 'SN-001',
        customerCompanyId: 'company-1',
        catalogProductId: 'catalog-1',
        siteName: 'Factory A',
        siteAddress: null,
        locationLabel: 'Hall B',
      },
    })
    mockFetchMachineProfileByCatalogProductId.mockResolvedValue({
      id: 'profile-1',
      catalogProductId: 'catalog-1',
      machineFamily: 'CNC',
      modelCode: '6000',
      defaultServiceDurationMinutes: 120,
      preventiveMaintenanceIntervalDays: 180,
      serviceNotes: 'Check lubrication',
    })
    mockFetchMachinePartTemplates.mockResolvedValue([
      {
        id: 'part-1',
        partName: 'Oil filter',
        partCode: 'FLT-1',
        quantityDefault: '2',
        quantityUnit: 'pcs',
        serviceContext: 'preventive',
        kitName: 'Annual kit',
      },
    ])
  })

  it('hydrates selected machine hints from a stored machine id', async () => {
    render(
      <MachineCascadeSelect
        machineId="machine-1"
        customerId="company-1"
        contactPersonId=""
        address="Existing address"
        label="Machine"
        placeholder="Search machines"
        messages={MESSAGES}
        setMachineId={jest.fn()}
        setCustomerId={jest.fn()}
        setContactPersonId={jest.fn()}
        setAddress={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockFetchMachineById).toHaveBeenCalledWith('machine-1')
      expect(mockFetchMachineProfileByCatalogProductId).toHaveBeenCalledWith('catalog-1')
      expect(mockFetchMachinePartTemplates).toHaveBeenCalledWith('profile-1')
    })

    expect(screen.getByTestId('service-ticket-machine-hints')).toHaveTextContent('Machine Guidance')
    expect(screen.getByTestId('service-ticket-machine-hints')).toHaveTextContent('CNC • 6000')
    expect(screen.getByTestId('service-ticket-machine-hints')).toHaveTextContent('Oil filter')
  })

  it('fills customer and empty address from the selected machine and clears stale contact', async () => {
    const setMachineId = jest.fn()
    const setCustomerId = jest.fn()
    const setContactPersonId = jest.fn()
    const setAddress = jest.fn()

    render(
      <MachineCascadeSelect
        machineId=""
        customerId="company-old"
        contactPersonId="person-1"
        address=""
        label="Machine"
        placeholder="Search machines"
        messages={MESSAGES}
        setMachineId={setMachineId}
        setCustomerId={setCustomerId}
        setContactPersonId={setContactPersonId}
        setAddress={setAddress}
      />,
    )

    const input = screen.getByTestId('service-ticket-machine-field').querySelector('input')
    expect(input).not.toBeNull()

    fireEvent.change(input as HTMLInputElement, { target: { value: 'machine-1' } })
    fireEvent.blur(input as HTMLInputElement)

    await waitFor(() => {
      expect(setMachineId).toHaveBeenCalledWith('machine-1')
      expect(setCustomerId).toHaveBeenCalledWith('company-1')
      expect(setContactPersonId).toHaveBeenCalledWith('')
      expect(setAddress).toHaveBeenCalledWith('Factory A • Hall B')
    })
  })

  it('does not overwrite an address that is already filled in', async () => {
    const setMachineId = jest.fn()
    const setAddress = jest.fn()

    render(
      <MachineCascadeSelect
        machineId=""
        customerId=""
        contactPersonId=""
        address="Manual address"
        label="Machine"
        placeholder="Search machines"
        messages={MESSAGES}
        setMachineId={setMachineId}
        setCustomerId={jest.fn()}
        setContactPersonId={jest.fn()}
        setAddress={setAddress}
      />,
    )

    const input = screen.getByTestId('service-ticket-machine-field').querySelector('input')
    expect(input).not.toBeNull()

    fireEvent.change(input as HTMLInputElement, { target: { value: 'machine-1' } })
    fireEvent.blur(input as HTMLInputElement)

    await waitFor(() => {
      expect(setMachineId).toHaveBeenCalledWith('machine-1')
    })

    expect(setAddress).not.toHaveBeenCalled()
  })
})
