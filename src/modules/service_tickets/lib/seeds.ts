import type { EntityManager } from '@mikro-orm/postgresql'
import {
  ServiceTicket,
  ServiceTicketAssignment,
  ServiceTicketPart,
  ServiceTicketDateChange,
} from '../data/entities'
import type { ServiceType, TicketStatus, TicketPriority } from './constants'

export type ServiceTicketSeedScope = { tenantId: string; organizationId: string }

type TicketSeed = {
  ticketNumber: string
  serviceType: ServiceType
  status: TicketStatus
  priority: TicketPriority
  description: string
  visitDayOffset: number | null
  visitEndDayOffset: number | null
  address: string | null
  customerName: string | null
  contactPersonName: string | null
  staffNames: string[]
  parts: { sku: string; quantity: number; notes: string | null }[]
  dateChanges: { oldDayOffset: number; newDayOffset: number; reason: string }[]
}

const SEED_TICKETS: TicketSeed[] = [
  {
    ticketNumber: 'SRV-000001',
    serviceType: 'commissioning',
    status: 'new',
    priority: 'normal',
    description: 'New espresso machine installation at downtown cafe. Customer requests morning slot.',
    visitDayOffset: 5,
    visitEndDayOffset: 5,
    address: 'ul. Marszalkowska 12, Warszawa',
    customerName: 'Acme Corp',
    contactPersonName: null,
    staffNames: [],
    parts: [],
    dateChanges: [],
  },
  {
    ticketNumber: 'SRV-000002',
    serviceType: 'regular',
    status: 'scheduled',
    priority: 'normal',
    description: 'Quarterly maintenance of industrial printer. Replace toner cartridge and clean rollers.',
    visitDayOffset: 3,
    visitEndDayOffset: 3,
    address: 'ul. Dluga 45, Gdansk',
    customerName: 'Globex Inc',
    contactPersonName: null,
    staffNames: ['Jan Kowalski'],
    parts: [{ sku: 'ATLAS-RUNNER', quantity: 2, notes: 'Placeholder — replace with actual toner SKU' }],
    dateChanges: [],
  },
  {
    ticketNumber: 'SRV-000003',
    serviceType: 'warranty_claim',
    status: 'in_progress',
    priority: 'urgent',
    description: 'Customer reports intermittent power failure on unit purchased 3 months ago. Under warranty.',
    visitDayOffset: -1,
    visitEndDayOffset: 0,
    address: 'ul. Piotrkowska 100, Lodz',
    customerName: 'Acme Corp',
    contactPersonName: null,
    staffNames: ['Jan Kowalski'],
    parts: [
      { sku: 'ATLAS-RUNNER', quantity: 1, notes: 'Power supply board — placeholder SKU' },
      { sku: 'SUMMIT-PRO', quantity: 1, notes: 'Diagnostic cable — placeholder SKU' },
    ],
    dateChanges: [
      { oldDayOffset: -7, newDayOffset: -1, reason: 'Rescheduled — waiting for replacement part delivery' },
    ],
  },
  {
    ticketNumber: 'SRV-000004',
    serviceType: 'maintenance',
    status: 'completed',
    priority: 'normal',
    description: 'Annual HVAC system inspection and filter replacement. All units passed. Report attached.',
    visitDayOffset: -14,
    visitEndDayOffset: -14,
    address: 'ul. Krakowska 8, Poznan',
    customerName: 'Globex Inc',
    contactPersonName: null,
    staffNames: ['Anna Nowak'],
    parts: [{ sku: 'SUMMIT-PRO', quantity: 4, notes: 'HVAC filters — placeholder SKU' }],
    dateChanges: [],
  },
  {
    ticketNumber: 'SRV-000005',
    serviceType: 'regular',
    status: 'cancelled',
    priority: 'normal',
    description: 'Scheduled printer repair — customer cancelled, resolved issue internally.',
    visitDayOffset: -5,
    visitEndDayOffset: -5,
    address: null,
    customerName: 'Acme Corp',
    contactPersonName: null,
    staffNames: [],
    parts: [],
    dateChanges: [],
  },
  {
    ticketNumber: 'SRV-000006',
    serviceType: 'commissioning',
    status: 'scheduled',
    priority: 'critical',
    description: 'Urgent server rack installation for new data center wing. Hard deadline — go-live next week.',
    visitDayOffset: 2,
    visitEndDayOffset: 4,
    address: 'ul. Techniczna 1, Wroclaw',
    customerName: 'Globex Inc',
    contactPersonName: null,
    staffNames: ['Jan Kowalski', 'Anna Nowak'],
    parts: [{ sku: 'ATLAS-RUNNER', quantity: 1, notes: 'Rack mount kit — placeholder SKU' }],
    dateChanges: [
      { oldDayOffset: 7, newDayOffset: 2, reason: 'Customer escalated — moved to critical priority' },
    ],
  },
  {
    ticketNumber: 'SRV-000007',
    serviceType: 'warranty_claim',
    status: 'new',
    priority: 'urgent',
    description: 'Display panel cracked on delivery. Customer requesting immediate replacement under warranty.',
    visitDayOffset: null,
    visitEndDayOffset: null,
    address: 'ul. Slowackiego 22, Krakow',
    customerName: 'Acme Corp',
    contactPersonName: null,
    staffNames: [],
    parts: [],
    dateChanges: [],
  },
  {
    ticketNumber: 'SRV-000008',
    serviceType: 'maintenance',
    status: 'in_progress',
    priority: 'normal',
    description: 'Multi-day elevator modernization. Phase 2 of 3 — control panel upgrade in progress.',
    visitDayOffset: -3,
    visitEndDayOffset: 1,
    address: 'ul. Powstancow 15, Katowice',
    customerName: 'Globex Inc',
    contactPersonName: null,
    staffNames: ['Anna Nowak'],
    parts: [
      { sku: 'SUMMIT-PRO', quantity: 2, notes: 'Control boards — placeholder SKU' },
      { sku: 'ATLAS-RUNNER', quantity: 3, notes: 'Wiring harness — placeholder SKU' },
    ],
    dateChanges: [
      { oldDayOffset: -10, newDayOffset: -5, reason: 'Phase 1 delayed due to part shortage' },
      { oldDayOffset: -5, newDayOffset: -3, reason: 'Adjusted after Phase 1 completion' },
    ],
  },
]

/**
 * Compute a Date from a day-offset relative to now, normalized to 09:00 local time.
 */
export function dateFromDayOffset(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(9, 0, 0, 0)
  return d
}

/**
 * Look up IDs by display_name from a cross-module table using Knex.
 * Returns a Map of display_name → id.
 */
async function lookupByDisplayName(
  knex: any,
  table: string,
  names: string[],
  scope: ServiceTicketSeedScope,
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map()
  const rows: { id: string; display_name: string }[] = await knex(table)
    .select('id', 'display_name')
    .whereIn('display_name', names)
    .andWhere({ organization_id: scope.organizationId, tenant_id: scope.tenantId })
  return new Map(rows.map((r) => [r.display_name, r.id]))
}

/**
 * Look up product IDs by SKU from catalog_products using Knex.
 * Returns a Map of sku → id.
 */
async function lookupProductsBySku(
  knex: any,
  skus: string[],
  scope: ServiceTicketSeedScope,
): Promise<Map<string, string>> {
  if (skus.length === 0) return new Map()
  const rows: { id: string; sku: string }[] = await knex('catalog_products')
    .select('id', 'sku')
    .whereIn('sku', skus)
    .andWhere({ organization_id: scope.organizationId, tenant_id: scope.tenantId })
  return new Map(rows.map((r) => [r.sku, r.id]))
}

/**
 * Seed 8 example service tickets with cross-module references.
 * Idempotent: skips if any tickets already exist for the tenant/org.
 */
export async function seedServiceTicketExamples(
  em: EntityManager,
  scope: ServiceTicketSeedScope,
): Promise<void> {
  const existingCount = await em.count(ServiceTicket, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  if (existingCount > 0) return

  const knex = (em as any).getConnection().getKnex()

  // Collect all unique names/SKUs for batch lookup
  const allCustomerNames = [...new Set(SEED_TICKETS.map((t) => t.customerName).filter((n): n is string => !!n))]
  const allContactNames = [...new Set(SEED_TICKETS.map((t) => t.contactPersonName).filter((n): n is string => !!n))]
  const allStaffNames = [...new Set(SEED_TICKETS.flatMap((t) => t.staffNames))]
  const allSkus = [...new Set(SEED_TICKETS.flatMap((t) => t.parts.map((p) => p.sku)))]

  const customerMap = await lookupByDisplayName(knex, 'customer_entities', allCustomerNames, scope)
  const contactMap = await lookupByDisplayName(knex, 'customer_entities', allContactNames, scope)
  const staffMap = await lookupByDisplayName(knex, 'staff_team_members', allStaffNames, scope)
  const productMap = await lookupProductsBySku(knex, allSkus, scope)

  for (const seed of SEED_TICKETS) {
    const ticket = em.create(ServiceTicket, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      ticketNumber: seed.ticketNumber,
      serviceType: seed.serviceType,
      status: seed.status,
      priority: seed.priority,
      description: seed.description,
      visitDate: seed.visitDayOffset != null ? dateFromDayOffset(seed.visitDayOffset) : null,
      visitEndDate: seed.visitEndDayOffset != null ? dateFromDayOffset(seed.visitEndDayOffset) : null,
      address: seed.address,
      customerEntityId: seed.customerName ? (customerMap.get(seed.customerName) ?? null) : null,
      contactPersonId: seed.contactPersonName ? (contactMap.get(seed.contactPersonName) ?? null) : null,
    })
    em.persist(ticket)

    // Staff assignments
    for (const staffName of seed.staffNames) {
      const staffId = staffMap.get(staffName)
      if (!staffId) continue
      const assignment = em.create(ServiceTicketAssignment, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        ticket,
        staffMemberId: staffId,
      })
      em.persist(assignment)
    }

    // Parts
    for (const part of seed.parts) {
      const productId = productMap.get(part.sku)
      if (!productId) continue
      const ticketPart = em.create(ServiceTicketPart, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        ticket,
        productId,
        quantity: part.quantity,
        notes: part.notes,
      })
      em.persist(ticketPart)
    }

    // Date changes
    for (const dc of seed.dateChanges) {
      const dateChange = em.create(ServiceTicketDateChange, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        ticket,
        oldDate: dateFromDayOffset(dc.oldDayOffset),
        newDate: dateFromDayOffset(dc.newDayOffset),
        reason: dc.reason,
      })
      em.persist(dateChange)
    }
  }

  await em.flush()
}
