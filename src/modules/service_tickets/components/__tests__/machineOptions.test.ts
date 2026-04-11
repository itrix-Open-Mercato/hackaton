/**
 * @jest-environment node
 */

const mockReadApiResultOrThrow = jest.fn()

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  readApiResultOrThrow: (...args: unknown[]) => mockReadApiResultOrThrow(...args),
}), { virtual: true })

import {
  buildMachineLabel,
  fetchMachineById,
  fetchMachineProfileByCatalogProductId,
  fetchMachinePartTemplates,
  formatMachineAddress,
  mergeMachineOptions,
  searchMachines,
} from '../machineOptions'

describe('machineOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchMachineById', () => {
    it('uses ids= (plural) query parameter, not id= (singular)', async () => {
      const machineId = '7e4b9a04-2ecf-4daa-91f0-e221cfee83db'

      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: machineId,
            instanceCode: 'RES-00041',
            serialNumber: 'PM6000-2021-001',
            customerCompanyId: 'company-1',
            catalogProductId: 'catalog-1',
            siteName: 'Fabryka Części',
            siteAddress: null,
            locationLabel: 'Hala B',
          },
        ],
      })

      await fetchMachineById(machineId)

      const url = mockReadApiResultOrThrow.mock.calls[0][0] as string
      expect(url).toContain('ids=')
      expect(url).not.toMatch(/[?&]id=/)
      expect(url).toContain(encodeURIComponent(machineId))
      expect(url).toContain('pageSize=1')
    })

    it('returns the matching machine as a MachineOption', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'machine-1',
            instanceCode: 'RES-00041',
            serialNumber: 'PM6000-2021-001',
            customerCompanyId: null,
            catalogProductId: 'catalog-1',
            siteName: 'Fabryka',
            siteAddress: null,
            locationLabel: null,
          },
        ],
      })

      const result = await fetchMachineById('machine-1')
      expect(result).not.toBeNull()
      expect(result!.value).toBe('machine-1')
      expect(result!.record.instanceCode).toBe('RES-00041')
      expect(result!.record.catalogProductId).toBe('catalog-1')
    })

    it('returns null when the API returns no items', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({ items: [] })

      const result = await fetchMachineById('nonexistent-id')
      expect(result).toBeNull()
    })

    it('maps snake_case API response keys correctly', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'machine-2',
            instance_code: 'RES-00089',
            serial_number: 'TM25-2022-003',
            customer_company_id: 'company-2',
            catalog_product_id: 'catalog-2',
            site_name: 'Zakład Główny',
            site_address: { formatted: 'ul. Testowa 1' },
            location_label: 'Parter',
          },
        ],
      })

      const result = await fetchMachineById('machine-2')
      expect(result).not.toBeNull()
      expect(result!.record.instanceCode).toBe('RES-00089')
      expect(result!.record.serialNumber).toBe('TM25-2022-003')
      expect(result!.record.customerCompanyId).toBe('company-2')
      expect(result!.record.catalogProductId).toBe('catalog-2')
      expect(result!.record.siteName).toBe('Zakład Główny')
      expect(result!.record.locationLabel).toBe('Parter')
    })

    it('maps camelCase API response keys correctly', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'machine-3',
            instanceCode: 'RES-00067',
            serialNumber: null,
            customerCompanyId: null,
            catalogProductId: 'catalog-3',
            siteName: null,
            siteAddress: null,
            locationLabel: null,
          },
        ],
      })

      const result = await fetchMachineById('machine-3')
      expect(result).not.toBeNull()
      expect(result!.record.instanceCode).toBe('RES-00067')
      expect(result!.record.catalogProductId).toBe('catalog-3')
    })
  })

  describe('fetchMachineProfileByCatalogProductId', () => {
    it('queries the machine_catalog API with catalogProductId filter', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'profile-1',
            catalogProductId: 'catalog-1',
            machineFamily: 'CNC',
            modelCode: '6000',
            defaultServiceDurationMinutes: 120,
            preventiveMaintenanceIntervalDays: 180,
            serviceNotes: 'Check lubrication',
          },
        ],
      })

      const result = await fetchMachineProfileByCatalogProductId('catalog-1')

      const url = mockReadApiResultOrThrow.mock.calls[0][0] as string
      expect(url).toContain('/api/machine_catalog/machine-profiles')
      expect(url).toContain('catalogProductId=catalog-1')
      expect(result).not.toBeNull()
      expect(result!.machineFamily).toBe('CNC')
      expect(result!.defaultServiceDurationMinutes).toBe(120)
    })

    it('maps snake_case profile response keys', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'profile-2',
            catalog_product_id: 'catalog-2',
            machine_family: 'HVAC',
            model_code: 'TM25',
            default_service_duration_minutes: 180,
            preventive_maintenance_interval_days: 365,
            service_notes: 'F-GAZ check',
          },
        ],
      })

      const result = await fetchMachineProfileByCatalogProductId('catalog-2')
      expect(result).not.toBeNull()
      expect(result!.machineFamily).toBe('HVAC')
      expect(result!.modelCode).toBe('TM25')
      expect(result!.defaultServiceDurationMinutes).toBe(180)
      expect(result!.preventiveMaintenanceIntervalDays).toBe(365)
      expect(result!.serviceNotes).toBe('F-GAZ check')
    })

    it('returns null when no profile found', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({ items: [] })

      const result = await fetchMachineProfileByCatalogProductId('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('fetchMachinePartTemplates', () => {
    it('queries with machineProfileId and maps both casings', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'part-1',
            part_name: 'Oil filter',
            part_code: 'FLT-1',
            quantity_default: '2',
            quantity_unit: 'pcs',
            service_context: 'preventive',
            kit_name: 'Annual kit',
          },
          {
            id: 'part-2',
            partName: 'Bearing',
            partCode: 'BRG-9',
            quantityDefault: '4',
            quantityUnit: 'pcs',
            serviceContext: 'repair',
            kitName: null,
          },
        ],
      })

      const result = await fetchMachinePartTemplates('profile-1')

      const url = mockReadApiResultOrThrow.mock.calls[0][0] as string
      expect(url).toContain('machineProfileId=profile-1')

      expect(result).toHaveLength(2)
      expect(result[0].partName).toBe('Oil filter')
      expect(result[0].partCode).toBe('FLT-1')
      expect(result[1].partName).toBe('Bearing')
      expect(result[1].serviceContext).toBe('repair')
    })
  })

  describe('searchMachines', () => {
    it('includes search term in query and maps results', async () => {
      mockReadApiResultOrThrow.mockResolvedValue({
        items: [
          {
            id: 'machine-1',
            instanceCode: 'RES-00041',
            serialNumber: null,
            customerCompanyId: null,
            catalogProductId: null,
            siteName: 'Test',
            siteAddress: null,
            locationLabel: null,
          },
        ],
      })

      const result = await searchMachines('RES')
      const url = mockReadApiResultOrThrow.mock.calls[0][0] as string
      expect(url).toContain('search=RES')
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe('machine-1')
    })
  })

  describe('buildMachineLabel', () => {
    it('joins non-empty fields with bullet separator', () => {
      expect(
        buildMachineLabel({
          id: 'x',
          instanceCode: 'RES-00041',
          serialNumber: 'PM6000-2021-001',
          customerCompanyId: null,
          catalogProductId: null,
          siteName: 'Fabryka Części',
          siteAddress: null,
          locationLabel: 'Hala B',
        }),
      ).toBe('RES-00041 • PM6000-2021-001 • Fabryka Części • Hala B')
    })

    it('omits null fields', () => {
      expect(
        buildMachineLabel({
          id: 'x',
          instanceCode: 'RES-00041',
          serialNumber: null,
          customerCompanyId: null,
          catalogProductId: null,
          siteName: null,
          siteAddress: null,
          locationLabel: null,
        }),
      ).toBe('RES-00041')
    })
  })

  describe('formatMachineAddress', () => {
    it('formats address from siteAddress object fields', () => {
      expect(
        formatMachineAddress({
          id: 'x',
          instanceCode: 'RES-00041',
          serialNumber: null,
          customerCompanyId: null,
          catalogProductId: null,
          siteName: 'Fabryka',
          siteAddress: { formatted: 'ul. Testowa 1, Warszawa' },
          locationLabel: 'Hala B',
        }),
      ).toBe('Fabryka • ul. Testowa 1, Warszawa • Hala B')
    })

    it('returns null when no location information', () => {
      expect(
        formatMachineAddress({
          id: 'x',
          instanceCode: 'RES-00041',
          serialNumber: null,
          customerCompanyId: null,
          catalogProductId: null,
          siteName: null,
          siteAddress: null,
          locationLabel: null,
        }),
      ).toBeNull()
    })
  })

  describe('mergeMachineOptions', () => {
    it('deduplicates by value, keeping newest', () => {
      const old = [{ value: 'a', label: 'Old A', record: { id: 'a' } as any }]
      const next = [{ value: 'a', label: 'New A', record: { id: 'a' } as any }]

      const result = mergeMachineOptions(old, next)
      expect(result).toHaveLength(1)
      expect(result[0].label).toBe('New A')
    })

    it('merges distinct options', () => {
      const old = [{ value: 'a', label: 'A', record: { id: 'a' } as any }]
      const next = [{ value: 'b', label: 'B', record: { id: 'b' } as any }]

      const result = mergeMachineOptions(old, next)
      expect(result).toHaveLength(2)
    })
  })
})
