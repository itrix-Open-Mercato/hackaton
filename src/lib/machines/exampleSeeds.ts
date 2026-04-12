import type { EntityManager } from '@mikro-orm/postgresql'
import { CatalogProduct } from '@open-mercato/core/modules/catalog/data/entities'
import { CustomerCompanyProfile, CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { MachineCatalogProfile } from '../../modules/machine_catalog/data/entities'
import { MachineInstance } from '../../modules/machine_instances/data/entities'

export type MachineSeedScope = {
  tenantId: string
  organizationId: string
}

type ServiceTypeSeed = {
  serviceType: string
  defaultTeamSize: number
  defaultServiceDurationMinutes: number
  startupNotes?: string | null
  serviceNotes?: string | null
  requiredSkills: string[]
  requiredCertifications: string[]
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
    preventiveMaintenanceIntervalDays: number
    defaultWarrantyMonths: number
  }
  serviceTypes: ServiceTypeSeed[]
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
  // ── CNC Milling Machine ─────────────────────────────────────────────────
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
      preventiveMaintenanceIntervalDays: 180,
      defaultWarrantyMonths: 36,
    },
    serviceTypes: [
      {
        serviceType: 'Uruchomienie',
        defaultTeamSize: 3,
        defaultServiceDurationMinutes: 480,
        requiredSkills: ['cnc', 'hydraulika', 'elektryka przemysłowa', 'mechanika precyzyjna'],
        requiredCertifications: ['UDT – obsługa wciągników', 'SEP do 1 kV'],
        startupNotes: 'Wymagany dźwig do rozładunku (4,8 t). Fundament musi być przygotowany wg DTR min. 7 dni wcześniej. Sprawdzić poziomowanie laserowe po posadowieniu.',
        serviceNotes: 'Uruchomienie obejmuje: posadowienie, podłączenie zasilania 400V, napełnienie układu hydraulicznego, kalibrację 5 osi, test cięcia próbnego i szkolenie 2 operatorów.',
      },
      {
        serviceType: 'Przegląd okresowy',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 240,
        requiredSkills: ['cnc', 'hydraulika', 'mechanika precyzyjna'],
        requiredCertifications: [],
        startupNotes: 'Awizacja 48 h przed wizytą (ochrona, brama B). Maszyna musi być wyłączona i ostudzona min. 2 h.',
        serviceNotes: 'Zakres: wymiana filtra oleju hydraulicznego, kontrola pasków napędowych wrzeciona, sprawdzenie luzów na prowadnicach, test geometrii, aktualizacja oprogramowania sterowania jeśli dostępna.',
      },
      {
        serviceType: 'Przegląd roczny rozszerzony',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 480,
        requiredSkills: ['cnc', 'hydraulika', 'mechanika precyzyjna', 'elektryka przemysłowa'],
        requiredCertifications: ['SEP do 1 kV'],
        startupNotes: 'Przegląd wymaga zatrzymania maszyny na pełną zmianę. Zamówić części z zestawu B min. 14 dni wcześniej.',
        serviceNotes: 'Rozszerzony o: wymianę łożysk wrzeciona, regenerację pompy hydraulicznej, wymianę kabla enkodera, przegląd szafy elektrycznej, pomiar rezystancji izolacji, kalibrację laserową pełną.',
      },
      {
        serviceType: 'Naprawa awaryjna',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 180,
        requiredSkills: ['cnc', 'diagnostyka usterek', 'hydraulika', 'elektryka przemysłowa'],
        requiredCertifications: ['SEP do 1 kV'],
        startupNotes: 'Sprawdzić kod błędu na panelu sterowania przed przyjazdem. Zebrać logi z ostatnich 24 h ze sterownika.',
        serviceNotes: 'Diagnostyka obejmuje: odczyt logów sterownika, kontrolę czujników, pomiary elektryczne silnika i enkodera, test hydrauliki pod ciśnieniem. Po naprawie obowiązkowy test cięcia próbnego.',
      },
      {
        serviceType: 'Reklamacja gwarancyjna',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 240,
        requiredSkills: ['cnc', 'diagnostyka usterek', 'mechanika precyzyjna'],
        requiredCertifications: [],
        startupNotes: 'Wymagana dokumentacja fotograficzna usterki i kopia protokołu zgłoszenia. Nie demontować uszkodzonych części przed wizytą serwisową.',
        serviceNotes: 'Procedura: oględziny, dokumentacja fotograficzna, demontaż wadliwego podzespołu, montaż zamiennika, test funkcjonalny, raport do producenta.',
      },
    ],
  },
  // ── Heat Pump ───────────────────────────────────────────────────────────
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
      preventiveMaintenanceIntervalDays: 365,
      defaultWarrantyMonths: 36,
    },
    serviceTypes: [
      {
        serviceType: 'Uruchomienie',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 360,
        requiredSkills: ['hvac', 'hydraulika instalacyjna', 'chłodnictwo', 'elektryka'],
        requiredCertifications: ['F-GAZ kat. I', 'SEP do 1 kV'],
        startupNotes: 'Instalacja hydrauliczna musi być wykonana i napełniona przed wizytą. Sprawdzić przepływomierzem wydatek obiegu glikolowego. Dostęp na dach wymaga klucza u ochrony.',
        serviceNotes: 'Uruchomienie: kontrola szczelności układu chłodniczego (próba ciśnieniowa N₂), napełnienie czynnikiem R-32, wpis do karty F-GAZ, ustawienie krzywej grzewczej, test trybu grzania i chłodzenia, szkolenie administratora budynku.',
      },
      {
        serviceType: 'Przegląd roczny',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 180,
        requiredSkills: ['hvac', 'diagnostyka chłodnicza'],
        requiredCertifications: ['F-GAZ kat. I'],
        startupNotes: 'Zabrać manometry i detektor nieszczelności. Przegląd wykonywać przy temperaturze zewnętrznej powyżej 5°C.',
        serviceNotes: 'Zakres: kontrola szczelności F-GAZ z wpisem do karty, czyszczenie skraplacza, kontrola filtrów powietrza i wody, sprawdzenie ciśnienia w obiegu glikolowym, test zabezpieczeń, odczyt parametrów pracy ze sterownika.',
      },
      {
        serviceType: 'Przegląd 2-letni rozszerzony',
        defaultTeamSize: 2,
        defaultServiceDurationMinutes: 300,
        requiredSkills: ['hvac', 'diagnostyka chłodnicza', 'elektryka'],
        requiredCertifications: ['F-GAZ kat. I', 'SEP do 1 kV'],
        startupNotes: 'Wymaga krótkotrwałego wyłączenia ogrzewania budynku (max 4 h). Uzgodnić termin z administratorem.',
        serviceNotes: 'Rozszerzony o: wymianę zaworu rozprężnego, kontrolę kondensatora rozruchowego sprężarki, wymianę filtra-osuszacza, pomiar rezystancji izolacji silnika sprężarki, aktualizację firmware sterownika.',
      },
      {
        serviceType: 'Naprawa awaryjna',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 120,
        requiredSkills: ['hvac', 'diagnostyka chłodnicza', 'elektryka'],
        requiredCertifications: ['F-GAZ kat. I'],
        startupNotes: 'Sprawdzić kod błędu na sterowniku (zdalnie przez BMS jeśli podłączony). Zabrać detektor nieszczelności i zapas czynnika R-32.',
        serviceNotes: 'Diagnostyka: odczyt logów sterownika, kontrola ciśnień, test czujników temperatury, sprawdzenie zaworów, kontrola zabezpieczeń elektrycznych. Po naprawie: test pełnego cyklu grzanie/chłodzenie.',
      },
      {
        serviceType: 'Reklamacja gwarancyjna',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 180,
        requiredSkills: ['hvac', 'diagnostyka chłodnicza'],
        requiredCertifications: ['F-GAZ kat. I'],
        startupNotes: 'Wymagany aktualny wpis w karcie F-GAZ. Sprawdzić czy przeglądy były wykonywane terminowo (warunek gwarancji).',
        serviceNotes: 'Procedura: weryfikacja historii serwisowej, oględziny, dokumentacja, wymiana podzespołu, test, raport gwarancyjny do ThermoTech GmbH.',
      },
    ],
  },
  // ── Industrial Label Printer ────────────────────────────────────────────
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
      preventiveMaintenanceIntervalDays: 180,
      defaultWarrantyMonths: 36,
    },
    serviceTypes: [
      {
        serviceType: 'Uruchomienie',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 120,
        requiredSkills: ['druk termotransferowy', 'integracja linii pakowania'],
        requiredCertifications: [],
        startupNotes: 'Drukarka musi być zamontowana na linii pakowania i podłączona do zasilania przed wizytą. Przygotować próbki etykiet i taśmy TTR docelowego formatu.',
        serviceNotes: 'Uruchomienie: instalacja oprogramowania sterującego, konfiguracja formatu etykiety, kalibracja czujnika etykiet i taśmy, test wydruku 100 szt., integracja z systemem ERP/WMS klienta jeśli wymagana, szkolenie operatora.',
      },
      {
        serviceType: 'Przegląd półroczny',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 60,
        requiredSkills: ['druk termotransferowy', 'utrzymanie ruchu'],
        requiredCertifications: [],
        startupNotes: 'Okno serwisowe 6:00–8:00 (przed uruchomieniem linii). Zabrać zestaw czyszczący i wałek dociskowy na wymianę.',
        serviceNotes: 'Zakres: czyszczenie głowicy drukującej IPA 70%, wymiana wałka dociskowego, kontrola prowadnic taśmy i etykiet, czyszczenie czujników, test jakości wydruku (skan kodu kreskowego), aktualizacja firmware jeśli dostępna.',
      },
      {
        serviceType: 'Wymiana głowicy drukującej',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 90,
        requiredSkills: ['druk termotransferowy', 'kalibracja głowicy'],
        requiredCertifications: [],
        startupNotes: 'Wyłączyć drukarkę i odczekać 15 min do ostygnięcia głowicy. Przygotować nową głowicę 300 DPI (kod PRD-GLW-300D).',
        serviceNotes: 'Wymiana: demontaż starej głowicy, montaż nowej, kalibracja ciśnienia docisku, ustawienie balansu temperatury, test wydruku na 3 różnych materiałach etykiet, weryfikacja skanem kodów.',
      },
      {
        serviceType: 'Naprawa awaryjna',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 60,
        requiredSkills: ['druk termotransferowy', 'diagnostyka usterek'],
        requiredCertifications: [],
        startupNotes: 'Spisać kod błędu z wyświetlacza. Sprawdzić czy problem dotyczy mechanizmu, głowicy czy elektroniki (diody statusu na płycie głównej).',
        serviceNotes: 'Diagnostyka: odczyt logów, kontrola mechanizmu podawania, test czujników, sprawdzenie płyty sterującej. Najczęstsze usterki: zużyty wałek dociskowy, uszkodzony czujnik taśmy, przepalona głowica.',
      },
      {
        serviceType: 'Reklamacja gwarancyjna',
        defaultTeamSize: 1,
        defaultServiceDurationMinutes: 90,
        requiredSkills: ['druk termotransferowy'],
        requiredCertifications: [],
        startupNotes: 'Sprawdzić czy używano oryginalnych materiałów eksploatacyjnych (warunek gwarancji). Zabrać formularz reklamacyjny PrintCorp.',
        serviceNotes: 'Procedura: weryfikacja warunków eksploatacji, dokumentacja fotograficzna, wymiana wadliwego podzespołu, test, wypełnienie formularza gwarancyjnego PrintCorp S.A.',
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
  record.preventiveMaintenanceIntervalDays = seed.profile.preventiveMaintenanceIntervalDays
  record.defaultWarrantyMonths = seed.profile.defaultWarrantyMonths
  record.isActive = true

  em.persist(record)
  await em.flush()

  return record
}

async function ensureServiceType(
  em: EntityManager,
  scope: MachineSeedScope,
  machineProfileId: string,
  seed: ServiceTypeSeed,
  sortOrder: number,
): Promise<void> {
  // Use raw Knex — Node 24 tsx bug makes @app entity metadata invisible to CLI
  const knex = (em as any).getConnection().getKnex()
  const now = new Date()

  // Upsert service type
  const [existing] = await knex('machine_catalog_service_types')
    .where({
      tenant_id: scope.tenantId,
      organization_id: scope.organizationId,
      machine_profile_id: machineProfileId,
      service_type: seed.serviceType,
    })
    .whereNull('deleted_at')
    .select('id')
    .limit(1)

  let serviceTypeId: string
  if (existing) {
    serviceTypeId = existing.id
    await knex('machine_catalog_service_types')
      .where({ id: serviceTypeId })
      .update({
        default_team_size: seed.defaultTeamSize,
        default_service_duration_minutes: seed.defaultServiceDurationMinutes,
        startup_notes: seed.startupNotes ?? null,
        service_notes: seed.serviceNotes ?? null,
        sort_order: sortOrder,
        updated_at: now,
      })
  } else {
    const [inserted] = await knex('machine_catalog_service_types')
      .insert({
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        machine_profile_id: machineProfileId,
        service_type: seed.serviceType,
        default_team_size: seed.defaultTeamSize,
        default_service_duration_minutes: seed.defaultServiceDurationMinutes,
        startup_notes: seed.startupNotes ?? null,
        service_notes: seed.serviceNotes ?? null,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      })
      .returning('id')
    serviceTypeId = inserted.id
  }

  // Skills
  for (const skillName of seed.requiredSkills) {
    const [existingSkill] = await knex('machine_catalog_service_type_skills')
      .where({ machine_service_type_id: serviceTypeId, skill_name: skillName })
      .select('id')
      .limit(1)
    if (!existingSkill) {
      await knex('machine_catalog_service_type_skills').insert({
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        machine_service_type_id: serviceTypeId,
        skill_name: skillName,
        created_at: now,
      })
    }
  }

  // Certifications
  for (const certName of seed.requiredCertifications) {
    const [existingCert] = await knex('machine_catalog_service_type_certifications')
      .where({ machine_service_type_id: serviceTypeId, certification_name: certName })
      .select('id')
      .limit(1)
    if (!existingCert) {
      await knex('machine_catalog_service_type_certifications').insert({
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        machine_service_type_id: serviceTypeId,
        certification_name: certName,
        created_at: now,
      })
    }
  }
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
    for (let i = 0; i < seed.serviceTypes.length; i++) {
      await ensureServiceType(em, scope, profile.id, seed.serviceTypes[i], i * 10)
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
