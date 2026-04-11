import type { EntityManager } from '@mikro-orm/postgresql'
import { CatalogProduct } from '@open-mercato/core/modules/catalog/data/entities'
import { CustomerCompanyProfile, CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { MachineCatalogPartTemplate, MachineCatalogProfile } from '../../modules/machine_catalog/data/entities'
import { MachineInstance } from '../../modules/machine_instances/data/entities'

export type MachineSeedScope = {
  tenantId: string
  organizationId: string
}

type ProductSeed = {
  code: string
  title: string
  description: string
  category: string
  brand: string
  productLine: string
  technicalSpecification: Record<string, string>
  documentation: string[]
  profile: {
    machineFamily: string
    modelCode: string
    supportedServiceTypes: string[]
    requiredSkills: string[]
    requiredCertifications?: string[] | null
    defaultTeamSize: number
    defaultServiceDurationMinutes: number
    preventiveMaintenanceIntervalDays: number
    defaultWarrantyMonths: number
    startupNotes?: string | null
    serviceNotes?: string | null
  }
  partTemplates: Array<{
    templateType: 'component' | 'consumable' | 'service_kit_item'
    serviceContext: 'startup' | 'preventive' | 'repair' | 'reclamation' | 'maintenance_presence' | null
    kitName: string
    partName: string
    partCode?: string | null
    quantityDefault?: number | null
    quantityUnit?: string | null
    sortOrder: number
    notes?: string | null
  }>
}

type CompanySeed = {
  displayName: string
  legalName: string
  brandName?: string | null
  primaryEmail?: string | null
  primaryPhone?: string | null
  websiteUrl?: string | null
  industry?: string | null
  domain?: string | null
}

type MachineInstanceSeed = {
  instanceCode: string
  serialNumber: string
  productCode: string
  companyName: string
  siteName: string
  siteAddress: {
    formatted: string
    line1: string
    city: string
    country: string
  }
  locationLabel: string
  contactName: string
  contactPhone: string
  manufacturedAt: string
  commissionedAt: string
  warrantyUntil: string
  warrantyStatus: 'active' | 'expired' | 'claim'
  lastInspectionAt: string
  nextInspectionAt: string
  serviceCount: number
  complaintCount: number
  lastServiceCaseCode: string
  requiresAnnouncement: boolean
  announcementLeadTimeHours?: number | null
  instanceNotes?: string | null
}

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    code: 'PRD-CNC-6000',
    title: 'Frezarka CNC ProMill 6000',
    description: '5-osiowa frezarka CNC do ciężkich zastosowań produkcyjnych.',
    category: 'Obrabiarki CNC',
    brand: 'ProMill Industries',
    productLine: 'Seria 6000 Heavy Duty',
    technicalSpecification: {
      'Wymiary (D×S×W)': '6 000 × 2 400 × 3 100 mm',
      'Waga': '4 800 kg',
      'Moc silnika': '22 kW / 400V / 3-fazowe',
      'Liczba osi CNC': '5 osi',
      'Prędkość wrzeciona': '0 – 18 000 obr/min',
      'Certyfikaty': 'CE, ISO 9001',
    },
    documentation: [
      'ProMill6000_instrukcja_obslugi_PL_v3.2.pdf',
      'ProMill6000_schemat_elektryczny_rev5.dwg',
      'ProMill6000_DTR.pdf',
      'ProMill6000_BOM_lista_czesci_v2.xlsx',
    ],
    profile: {
      machineFamily: 'Obrabiarki CNC',
      modelCode: 'PRD-CNC-6000',
      supportedServiceTypes: ['commissioning', 'regular', 'maintenance', 'warranty_claim'],
      requiredSkills: ['cnc', 'hydraulika', 'mechanika precyzyjna'],
      requiredCertifications: ['CE', 'ISO 9001'],
      defaultTeamSize: 2,
      defaultServiceDurationMinutes: 240,
      preventiveMaintenanceIntervalDays: 180,
      defaultWarrantyMonths: 36,
      startupNotes: 'Dostęp do strefy produkcyjnej wymaga wcześniejszej awizacji i wejścia przez bramę B.',
      serviceNotes: 'Przegląd pełny obejmuje zestaw A oraz kontrolę wrzeciona, pompy i enkodera.',
    },
    partTemplates: [
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – przegląd 6-miesięczny',
        partName: 'Filtr oleju hydraulicznego',
        partCode: 'PRD-FLT-OH12',
        quantityDefault: 2,
        quantityUnit: 'szt.',
        sortOrder: 10,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – przegląd 6-miesięczny',
        partName: 'Pasek napędowy wrzeciona',
        partCode: 'PRD-PSK-WRZ4',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 20,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy B – przegląd 12-miesięczny',
        partName: 'Łożysko wrzeciona SKF 6206',
        partCode: 'PRD-LOZ-6206',
        quantityDefault: 2,
        quantityUnit: 'szt.',
        sortOrder: 30,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy B – przegląd 12-miesięczny',
        partName: 'Kabel enkodera 5m',
        partCode: 'PRD-KBL-ENC5',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 40,
      },
    ],
  },
  {
    code: 'PRD-HP-TM25',
    title: 'Pompa ciepła ThermoMax 25',
    description: 'Komercyjna pompa ciepła HVAC z obowiązkową kontrolą F-GAZ.',
    category: 'HVAC – Pompy ciepła',
    brand: 'ThermoTech GmbH',
    productLine: 'ThermoMax Commercial',
    technicalSpecification: {
      'Moc grzewcza': '25 kW',
      'Moc chłodnicza': '22 kW',
      'COP (ogrzewanie)': '4,2',
      'Czynnik chłodniczy': 'R-32',
      'Napięcie': '400V / 3-fazowe',
      'Wymiary (D×S×W)': '1 200 × 600 × 1 400 mm',
      'Waga': '185 kg',
      'Certyfikaty': 'CE, EN 14511, F-GAZ',
    },
    documentation: [
      'ThermoMax25_instrukcja_montazu_obslugi_v2.1.pdf',
      'ThermoMax25_schemat_hydrauliczny.dwg',
      'ThermoMax25_karta_FGAZ.pdf',
      'ThermoMax25_certyfikat_efektywnosci.pdf',
    ],
    profile: {
      machineFamily: 'HVAC – Pompy ciepła',
      modelCode: 'PRD-HP-TM25',
      supportedServiceTypes: ['commissioning', 'regular', 'maintenance', 'warranty_claim'],
      requiredSkills: ['hvac', 'diagnostyka chłodnicza'],
      requiredCertifications: ['F-GAZ kat. I'],
      defaultTeamSize: 1,
      defaultServiceDurationMinutes: 180,
      preventiveMaintenanceIntervalDays: 365,
      defaultWarrantyMonths: 36,
      startupNotes: 'Przy pierwszym uruchomieniu wymagane potwierdzenie obiegu hydraulicznego i wpis do karty F-GAZ.',
      serviceNotes: 'Roczny przegląd obejmuje kontrolę F-GAZ, skraplacza i układu hydraulicznego.',
    },
    partTemplates: [
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – przegląd roczny',
        partName: 'Filtr powietrza zewnętrzny G4',
        partCode: 'PRD-FLT-G4EX',
        quantityDefault: 2,
        quantityUnit: 'szt.',
        sortOrder: 10,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – przegląd roczny',
        partName: 'Filtr wody – wkład 1" siatkowy',
        partCode: 'PRD-FLT-W1IN',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 20,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy B – przegląd 2-letni',
        partName: 'Zawór rozprężny elektroniczny',
        partCode: 'PRD-ZAW-EXV1',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 30,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy B – przegląd 2-letni',
        partName: 'Kondensator rozruchowy sprężarki',
        partCode: 'PRD-ELK-CAP4',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 40,
      },
    ],
  },
  {
    code: 'PRD-PRT-LP800',
    title: 'LabelPro 800 Industrial',
    description: 'Przemysłowa drukarka termotransferowa do intensywnej pracy na liniach pakowania.',
    category: 'Drukarki przemysłowe',
    brand: 'PrintCorp S.A.',
    productLine: 'LabelPro Series 800',
    technicalSpecification: {
      'Technologia druku': 'Termotransfer (TTR)',
      'Rozdzielczość': '300 DPI',
      'Prędkość druku': 'do 200 mm/s',
      'Szerokość druku': 'maks. 108 mm',
      'Napięcie': '230V / 50Hz',
      'Wymiary': '430 × 295 × 360 mm',
      'Waga': '12,5 kg',
      'Certyfikaty': 'CE, IP54',
    },
    documentation: [
      'LabelPro800_instrukcja_obslugi_PL_v4.0.pdf',
      'LabelPro800_instrukcja_kalibracji_glowicy.pdf',
      'LabelPro800_kody_bledow_diagnostyka.pdf',
      'LabelPro800_BOM_czesci_zamienne.xlsx',
    ],
    profile: {
      machineFamily: 'Drukarki przemysłowe',
      modelCode: 'PRD-PRT-LP800',
      supportedServiceTypes: ['commissioning', 'regular', 'maintenance', 'warranty_claim'],
      requiredSkills: ['druk termotransferowy', 'utrzymanie ruchu'],
      requiredCertifications: null,
      defaultTeamSize: 1,
      defaultServiceDurationMinutes: 90,
      preventiveMaintenanceIntervalDays: 180,
      defaultWarrantyMonths: 36,
      startupNotes: 'Po wymianie głowicy należy wykonać kalibrację i potwierdzić przebieg wydruku.',
      serviceNotes: 'Przeglądy cykliczne obejmują czyszczenie mechanizmu i kontrolę przebiegu wydruku.',
    },
    partTemplates: [
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – czyszczenie 6-miesięczne',
        partName: 'Wałek dociskowy gumy',
        partCode: 'PRD-WLK-DOC1',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 10,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'preventive',
        kitName: 'Zestaw serwisowy A – czyszczenie 6-miesięczne',
        partName: 'Płyn czyszczący IPA 70% 250ml',
        partCode: 'PRD-CHM-IPA7',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 20,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'repair',
        kitName: 'Zestaw serwisowy B – wymiana głowicy',
        partName: 'Głowica drukująca 300 DPI OEM',
        partCode: 'PRD-GLW-300D',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 30,
      },
      {
        templateType: 'service_kit_item',
        serviceContext: 'repair',
        kitName: 'Zestaw serwisowy B – wymiana głowicy',
        partName: 'Czujnik końca taśmy',
        partCode: 'PRD-SEN-TSM1',
        quantityDefault: 1,
        quantityUnit: 'szt.',
        sortOrder: 40,
      },
    ],
  },
]

const COMPANY_SEEDS: CompanySeed[] = [
  {
    displayName: 'Fabryka Części Sp. z o.o.',
    legalName: 'Fabryka Części Sp. z o.o.',
    brandName: 'Fabryka Części',
    primaryEmail: 'lukasz.chrusciel@commerceweavers.com',
    primaryPhone: '+48 601 222 333',
    websiteUrl: 'https://fabryka-czesci.example',
    industry: 'Produkcja przemysłowa',
    domain: 'commerceweavers.com',
  },
  {
    displayName: 'Biurowiec Alfa Park Sp. z o.o.',
    legalName: 'Biurowiec Alfa Park Sp. z o.o.',
    brandName: 'Alfa Park',
    primaryEmail: 'technika@alfapark.example',
    primaryPhone: '+48 512 400 100',
    websiteUrl: 'https://alfapark.example',
    industry: 'Nieruchomości komercyjne',
  },
  {
    displayName: 'LogiPack Centrum Sp. k.',
    legalName: 'LogiPack Centrum Sp. k.',
    brandName: 'LogiPack Centrum',
    primaryEmail: 'utrzymanie.ruchu@logipack.example',
    primaryPhone: '+48 793 100 200',
    websiteUrl: 'https://logipack.example',
    industry: 'Logistyka i pakowanie',
  },
]

const INSTANCE_SEEDS: MachineInstanceSeed[] = [
  {
    instanceCode: 'RES-00041',
    serialNumber: 'PM6000-2021-001',
    productCode: 'PRD-CNC-6000',
    companyName: 'Fabryka Części Sp. z o.o.',
    siteName: 'Fabryka Części',
    siteAddress: {
      formatted: 'ul. Przemysłowa 12, Gliwice',
      line1: 'ul. Przemysłowa 12',
      city: 'Gliwice',
      country: 'Polska',
    },
    locationLabel: 'Hala B, stanowisko 4',
    contactName: 'Jan Kowalski',
    contactPhone: '+48 601 222 333',
    manufacturedAt: '2021-03-15',
    commissionedAt: '2021-05-08',
    warrantyUntil: '2024-05-08',
    warrantyStatus: 'expired',
    lastInspectionAt: '2025-11-20',
    nextInspectionAt: '2026-05-20',
    serviceCount: 7,
    complaintCount: 1,
    lastServiceCaseCode: 'ZGL-2025-0412',
    requiresAnnouncement: true,
    announcementLeadTimeHours: 48,
    instanceNotes: 'Dostęp przez bramę B, ochrona.',
  },
  {
    instanceCode: 'RES-00089',
    serialNumber: 'TM25-2023-003',
    productCode: 'PRD-HP-TM25',
    companyName: 'Biurowiec Alfa Park Sp. z o.o.',
    siteName: 'Alfa Park',
    siteAddress: {
      formatted: 'al. Jerozolimskie 190, Warszawa',
      line1: 'al. Jerozolimskie 190',
      city: 'Warszawa',
      country: 'Polska',
    },
    locationLabel: 'Dach – pom. techniczne P3',
    contactName: 'Marek Zięba',
    contactPhone: '+48 512 400 100',
    manufacturedAt: '2023-06-10',
    commissionedAt: '2023-09-01',
    warrantyUntil: '2026-09-01',
    warrantyStatus: 'active',
    lastInspectionAt: '2025-08-15',
    nextInspectionAt: '2026-08-15',
    serviceCount: 2,
    complaintCount: 0,
    lastServiceCaseCode: 'ZGL-2025-0871',
    requiresAnnouncement: false,
    announcementLeadTimeHours: null,
    instanceNotes: 'Klucz do dachu u ochrony, parter. Wymagany certyfikat F-GAZ kat. I.',
  },
  {
    instanceCode: 'RES-00067',
    serialNumber: 'LP800-2022-007',
    productCode: 'PRD-PRT-LP800',
    companyName: 'LogiPack Centrum Sp. k.',
    siteName: 'LogiPack Centrum',
    siteAddress: {
      formatted: 'ul. Magazynowa 5, Błonie',
      line1: 'ul. Magazynowa 5',
      city: 'Błonie',
      country: 'Polska',
    },
    locationLabel: 'Linia pakowania nr 3',
    contactName: 'Anna Nowak',
    contactPhone: '+48 793 100 200',
    manufacturedAt: '2022-01-20',
    commissionedAt: '2022-03-05',
    warrantyUntil: '2025-03-05',
    warrantyStatus: 'claim',
    lastInspectionAt: '2025-10-02',
    nextInspectionAt: '2026-04-02',
    serviceCount: 4,
    complaintCount: 2,
    lastServiceCaseCode: 'ZGL-2026-0115',
    requiresAnnouncement: true,
    announcementLeadTimeHours: 24,
    instanceNotes: 'Serwis tylko 6:00–8:00, linia 24/7. Awizacja SMS dzień wcześniej.',
  },
]

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureCatalogProduct(
  em: EntityManager,
  scope: MachineSeedScope,
  seed: ProductSeed,
): Promise<CatalogProduct> {
  let record = await em.findOne(CatalogProduct, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    sku: seed.code,
    deletedAt: null,
  })

  if (!record) {
    const now = new Date()
    record = em.create(CatalogProduct, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      title: seed.title,
      description: seed.description,
      sku: seed.code,
      handle: slugify(seed.code),
      productType: 'simple',
      defaultSalesUnit: 'szt.',
      defaultSalesUnitQuantity: '1',
      primaryCurrencyCode: 'PLN',
      metadata: {},
      isConfigurable: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  record.title = seed.title
  record.description = seed.description
  record.sku = seed.code
  record.handle = slugify(seed.code)
  record.productType = 'simple'
  record.defaultSalesUnit = 'szt.'
  record.defaultSalesUnitQuantity = '1'
  record.primaryCurrencyCode = 'PLN'
  record.isActive = true
  record.metadata = {
    ...(record.metadata ?? {}),
    seedSource: 'machine_examples',
    machineExample: true,
    machineCategory: seed.category,
    machineBrand: seed.brand,
    machineProductLine: seed.productLine,
    technicalSpecification: seed.technicalSpecification,
    documentation: seed.documentation,
  }

  em.persist(record)
  await em.flush()

  return record
}

async function ensureMachineProfile(
  em: EntityManager,
  scope: MachineSeedScope,
  product: CatalogProduct,
  seed: ProductSeed,
): Promise<MachineCatalogProfile> {
  let record = await em.findOne(MachineCatalogProfile, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    catalogProductId: product.id,
    deletedAt: null,
  })

  if (!record) {
    const now = new Date()
    record = em.create(MachineCatalogProfile, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      catalogProductId: product.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  record.machineFamily = seed.profile.machineFamily
  record.modelCode = seed.profile.modelCode
  record.supportedServiceTypes = seed.profile.supportedServiceTypes
  record.requiredSkills = seed.profile.requiredSkills
  record.requiredCertifications = seed.profile.requiredCertifications ?? null
  record.defaultTeamSize = seed.profile.defaultTeamSize
  record.defaultServiceDurationMinutes = seed.profile.defaultServiceDurationMinutes
  record.preventiveMaintenanceIntervalDays = seed.profile.preventiveMaintenanceIntervalDays
  record.defaultWarrantyMonths = seed.profile.defaultWarrantyMonths
  record.startupNotes = seed.profile.startupNotes ?? null
  record.serviceNotes = seed.profile.serviceNotes ?? null
  record.isActive = true

  em.persist(record)
  await em.flush()

  return record
}

async function ensurePartTemplate(
  em: EntityManager,
  scope: MachineSeedScope,
  machineProfileId: string,
  seed: ProductSeed['partTemplates'][number],
): Promise<void> {
  let record = await em.findOne(MachineCatalogPartTemplate, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    machineProfileId,
    kitName: seed.kitName,
    partName: seed.partName,
    deletedAt: null,
  })

  if (!record) {
    const now = new Date()
    record = em.create(MachineCatalogPartTemplate, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      machineProfileId,
      partName: seed.partName,
      templateType: seed.templateType,
      sortOrder: seed.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
  }

  record.partCatalogProductId = null
  record.templateType = seed.templateType
  record.serviceContext = seed.serviceContext
  record.kitName = seed.kitName
  record.partName = seed.partName
  record.partCode = seed.partCode ?? null
  record.quantityDefault = seed.quantityDefault ?? null
  record.quantityUnit = seed.quantityUnit ?? null
  record.sortOrder = seed.sortOrder
  record.notes = seed.notes ?? null

  em.persist(record)
}

async function ensureCompany(
  em: EntityManager,
  scope: MachineSeedScope,
  seed: CompanySeed,
): Promise<CustomerEntity> {
  let entity = await em.findOne(CustomerEntity, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    kind: 'company',
    displayName: seed.displayName,
    deletedAt: null,
  })

  if (!entity) {
    entity = em.create(CustomerEntity, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      kind: 'company',
      displayName: seed.displayName,
    })
  }

  entity.displayName = seed.displayName
  entity.primaryEmail = seed.primaryEmail ?? null
  entity.primaryPhone = seed.primaryPhone ?? null
  entity.source = 'machine_examples'
  entity.status = entity.status ?? 'customer'
  entity.lifecycleStage = entity.lifecycleStage ?? 'active'
  entity.isActive = true
  em.persist(entity)
  await em.flush()

  let profile = await em.findOne(CustomerCompanyProfile, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    entity,
  })

  if (!profile) {
    profile = em.create(CustomerCompanyProfile, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      entity,
    })
  }

  profile.legalName = seed.legalName
  profile.brandName = seed.brandName ?? null
  profile.websiteUrl = seed.websiteUrl ?? null
  profile.industry = seed.industry ?? null
  if (seed.domain) profile.domain = seed.domain

  em.persist(profile)
  await em.flush()

  return entity
}

async function ensureMachineInstance(
  em: EntityManager,
  scope: MachineSeedScope,
  seed: MachineInstanceSeed,
  catalogProductId: string,
  customerCompanyId: string,
): Promise<MachineInstance> {
  let record = await em.findOne(MachineInstance, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    instanceCode: seed.instanceCode,
    deletedAt: null,
  })

  if (!record) {
    const now = new Date()
    record = em.create(MachineInstance, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      instanceCode: seed.instanceCode,
      requiresAnnouncement: seed.requiresAnnouncement,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  record.catalogProductId = catalogProductId
  record.instanceCode = seed.instanceCode
  record.serialNumber = seed.serialNumber
  record.customerCompanyId = customerCompanyId
  record.siteName = seed.siteName
  record.siteAddress = seed.siteAddress
  record.locationLabel = seed.locationLabel
  record.contactName = seed.contactName
  record.contactPhone = seed.contactPhone
  record.manufacturedAt = toDate(seed.manufacturedAt)
  record.commissionedAt = toDate(seed.commissionedAt)
  record.warrantyUntil = toDate(seed.warrantyUntil)
  record.warrantyStatus = seed.warrantyStatus
  record.lastInspectionAt = toDate(seed.lastInspectionAt)
  record.nextInspectionAt = toDate(seed.nextInspectionAt)
  record.serviceCount = seed.serviceCount
  record.complaintCount = seed.complaintCount
  record.lastServiceCaseCode = seed.lastServiceCaseCode
  record.requiresAnnouncement = seed.requiresAnnouncement
  record.announcementLeadTimeHours = seed.announcementLeadTimeHours ?? null
  record.instanceNotes = seed.instanceNotes ?? null
  record.isActive = true

  em.persist(record)
  await em.flush()

  return record
}

export async function seedMachineCatalogExamples(
  em: EntityManager,
  scope: MachineSeedScope,
): Promise<Map<string, CatalogProduct>> {
  const productsByCode = new Map<string, CatalogProduct>()

  for (const seed of PRODUCT_SEEDS) {
    const product = await ensureCatalogProduct(em, scope, seed)
    const profile = await ensureMachineProfile(em, scope, product, seed)
    for (const partTemplate of seed.partTemplates) {
      await ensurePartTemplate(em, scope, profile.id, partTemplate)
    }
    await em.flush()
    productsByCode.set(seed.code, product)
  }

  return productsByCode
}

export async function seedMachineInstanceExamples(
  em: EntityManager,
  scope: MachineSeedScope,
): Promise<void> {
  const productsByCode = await seedMachineCatalogExamples(em, scope)
  const companiesByName = new Map<string, CustomerEntity>()

  for (const company of COMPANY_SEEDS) {
    const entity = await ensureCompany(em, scope, company)
    companiesByName.set(company.displayName, entity)
  }

  for (const seed of INSTANCE_SEEDS) {
    const product = productsByCode.get(seed.productCode)
    const company = companiesByName.get(seed.companyName)
    if (!product || !company) continue
    await ensureMachineInstance(em, scope, seed, product.id, company.id)
  }
}
