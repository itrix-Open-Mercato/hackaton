/**
 * @jest-environment node
 */
const mockReadApiResultOrThrow = jest.fn()

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  readApiResultOrThrow: (...args: unknown[]) => mockReadApiResultOrThrow(...args),
}))

import {
  fetchCompanyById,
  fetchCompanyPeople,
  fetchPersonById,
  mergeEntityOptions,
  searchCompanies,
} from '../customerOptions'

describe('customerOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searches companies and normalizes labels', async () => {
    mockReadApiResultOrThrow.mockResolvedValueOnce({
      items: [
        { id: 'company-1', display_name: 'Acme' },
        { companyId: 'company-2', name: 'Bravo' },
      ],
    })

    const result = await searchCompanies('ac')

    expect(mockReadApiResultOrThrow).toHaveBeenCalledWith('/api/customers/companies?pageSize=20&sortField=name&sortDir=asc&search=ac')
    expect(result).toEqual([
      { value: 'company-1', label: 'Acme' },
      { value: 'company-2', label: 'Bravo' },
    ])
  })

  it('loads single company and person records by id', async () => {
    mockReadApiResultOrThrow
      .mockResolvedValueOnce({ items: [{ id: 'company-1', display_name: 'Acme' }] })
      .mockResolvedValueOnce({ items: [{ id: 'person-1', display_name: 'Alice Doe' }] })

    await expect(fetchCompanyById('company-1')).resolves.toEqual({ value: 'company-1', label: 'Acme' })
    await expect(fetchPersonById('person-1')).resolves.toEqual({ value: 'person-1', label: 'Alice Doe' })
  })

  it('loads contact people from company detail include payloads', async () => {
    mockReadApiResultOrThrow.mockResolvedValueOnce({
      people: [
        { id: 'person-1', displayName: 'Alice Doe' },
        { id: 'person-2', displayName: 'Bob Doe' },
      ],
    })

    await expect(fetchCompanyPeople('company-1')).resolves.toEqual([
      { value: 'person-1', label: 'Alice Doe' },
      { value: 'person-2', label: 'Bob Doe' },
    ])
  })

  it('merges entity options without duplicating ids', () => {
    expect(
      mergeEntityOptions(
        [{ value: 'company-1', label: 'Acme' }],
        [
          { value: 'company-1', label: 'Acme Updated' },
          { value: 'company-2', label: 'Bravo' },
        ],
      ),
    ).toEqual([
      { value: 'company-1', label: 'Acme Updated' },
      { value: 'company-2', label: 'Bravo' },
    ])
  })
})
