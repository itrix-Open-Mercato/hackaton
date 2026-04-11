/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import {
  buildTicketFields,
  buildTicketGroups,
  createEmptyTicketFormValues,
  mapTicketToFormValues,
} from '../ticketFormConfig'

jest.mock('../CustomerCascadeSelect', () => ({
  __esModule: true,
  default: ({
    companyId,
    personId,
    companyLabel,
    personLabel,
  }: {
    companyId?: string | null
    personId?: string | null
    companyLabel: string
    personLabel: string
  }) => (
    <div data-testid="customer-cascade-select">
      <span>{companyLabel}:{companyId}</span>
      <span>{personLabel}:{personId}</span>
    </div>
  ),
}))

const t = (key: string) => key

describe('ticketFormConfig', () => {
  it('builds status-aware field definitions', () => {
    const createFields = buildTicketFields(t, { includeStatus: false })
    const editFields = buildTicketFields(t, { includeStatus: true })

    expect(createFields.some((field) => field.id === 'status')).toBe(false)
    expect(editFields.some((field) => field.id === 'status')).toBe(true)
    expect(editFields.find((field) => field.id === 'service_type')?.required).toBe(true)
  })

  it('builds groups with the linked customer selector component', () => {
    const groups = buildTicketGroups(t, { includeStatus: true })
    const linksGroup = groups.find((group) => group.id === 'links')

    expect(linksGroup).toBeDefined()
    expect(linksGroup?.fields).toEqual(['machine_asset_id', 'order_id'])

    if (!linksGroup?.component) {
      throw new Error('Expected links group component')
    }

    render(
      <>{linksGroup.component({
        values: { customer_entity_id: 'company-1', contact_person_id: 'person-1' },
        setValue: jest.fn(),
        errors: {},
      })}</>,
    )

    expect(screen.getByTestId('customer-cascade-select')).toHaveTextContent(
      'service_tickets.form.fields.customerEntityId.label:company-1',
    )
    expect(screen.getByTestId('customer-cascade-select')).toHaveTextContent(
      'service_tickets.form.fields.contactPersonId.label:person-1',
    )
  })

  it('maps defaults and existing ticket values into form state', () => {
    expect(createEmptyTicketFormValues('ticket-1')).toEqual({
      id: 'ticket-1',
      service_type: 'regular',
      status: 'new',
      priority: 'normal',
      description: '',
      visit_date: '',
      visit_end_date: '',
      address: '',
      customer_entity_id: '',
      contact_person_id: '',
      machine_asset_id: '',
      order_id: '',
    })

    expect(
      mapTicketToFormValues({
        id: 'ticket-1',
        ticketNumber: 'SRV-000001',
        serviceType: 'maintenance',
        status: 'scheduled',
        priority: 'urgent',
        description: 'Needs inspection',
        visitDate: '2026-04-11T09:15:00.000Z',
        visitEndDate: '2026-04-11T11:45:00.000Z',
        address: 'Dock 7',
        customerEntityId: 'company-1',
        contactPersonId: 'person-1',
        machineAssetId: 'machine-1',
        orderId: 'order-1',
      }),
    ).toEqual({
      id: 'ticket-1',
      service_type: 'maintenance',
      status: 'scheduled',
      priority: 'urgent',
      description: 'Needs inspection',
      visit_date: '2026-04-11T09:15',
      visit_end_date: '2026-04-11T11:45',
      address: 'Dock 7',
      customer_entity_id: 'company-1',
      contact_person_id: 'person-1',
      machine_asset_id: 'machine-1',
      order_id: 'order-1',
    })
  })
})
