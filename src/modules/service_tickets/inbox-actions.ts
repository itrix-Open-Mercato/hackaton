import type { InboxActionDefinition, InboxActionExecutionContext } from '@open-mercato/shared/modules/inbox-actions'
import { createServiceTicketPayloadSchema } from './data/inbox-validators'

// --- Freemail & domain utilities ---

const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
])

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase())
}

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? ''
}

// --- Discrepancy type ---

interface Discrepancy {
  type: string
  message: string
}

// --- Customer resolution ---

async function resolveCustomer(
  payload: Record<string, unknown>,
  knex: any,
  organizationId: string,
): Promise<{ customerId?: string; customerName?: string; confidence: number; discrepancies: Discrepancy[] }> {
  const email = payload.customer_email as string | undefined
  if (!email) {
    return { confidence: 0, discrepancies: [{ type: 'unknown_contact', message: 'No sender email provided' }] }
  }

  // 1. Exact email match
  const exactMatch = await knex('customer_entities')
    .select('id', 'display_name')
    .whereRaw('LOWER(primary_email) = LOWER(?)', [email])
    .where('organization_id', organizationId)
    .whereNull('deleted_at')
    .first()

  if (exactMatch) {
    return {
      customerId: exactMatch.id,
      customerName: exactMatch.display_name,
      confidence: 0.3,
      discrepancies: [],
    }
  }

  // 2. Domain fallback
  const domain = extractDomain(email)
  if (!domain || isFreemailDomain(domain)) {
    return { confidence: 0, discrepancies: [{ type: 'unknown_contact', message: `No customer found for email: ${email}` }] }
  }

  const domainMatches = await knex('customer_companies')
    .join('customer_entities', 'customer_companies.entity_id', 'customer_entities.id')
    .select('customer_entities.id', 'customer_entities.display_name')
    .whereRaw('LOWER(customer_companies.domain) = LOWER(?)', [domain])
    .where('customer_entities.organization_id', organizationId)
    .whereNull('customer_entities.deleted_at')

  if (domainMatches.length === 1) {
    return {
      customerId: domainMatches[0].id,
      customerName: domainMatches[0].display_name,
      confidence: 0.15,
      discrepancies: [],
    }
  }

  if (domainMatches.length > 1) {
    const names = domainMatches.map((m: any) => m.display_name).join(', ')
    return {
      confidence: 0,
      discrepancies: [{ type: 'ambiguous_customer', message: `Multiple customers match domain ${domain}: ${names}` }],
    }
  }

  // 3. No match
  return { confidence: 0, discrepancies: [{ type: 'unknown_contact', message: `No customer found for email: ${email}` }] }
}

// --- Machine resolution ---

async function resolveMachine(
  payload: Record<string, unknown>,
  knex: any,
  customerId: string,
  organizationId: string,
): Promise<{ machineId?: string; machineLabel?: string; confidence: number; discrepancies: Discrepancy[] }> {
  const hints = (payload.machine_hints as string[] | undefined) ?? []

  // Resolve entity_id → company_id (machine_instances uses customer_company_id)
  const company = await knex('customer_companies')
    .select('id')
    .where('entity_id', customerId)
    .first()

  if (!company) {
    // Customer entity has no company record — can't match machines
    if (hints.length > 0) {
      return { confidence: 0, discrepancies: [{ type: 'machine_not_found', message: `Could not match machine hints: ${hints.join(', ')}` }] }
    }
    return { confidence: 0, discrepancies: [] }
  }

  // Fetch active machines for this customer's company
  const machines = await knex('machine_instances')
    .select(
      'machine_instances.id',
      'machine_instances.serial_number',
      'machine_instances.instance_code',
      'machine_instances.catalog_product_id',
      'machine_instances.site_name',
    )
    .where('machine_instances.customer_company_id', company.id)
    .where('machine_instances.organization_id', organizationId)
    .where('machine_instances.is_active', true)

  if (hints.length === 0) {
    // Auto-suggest if customer has exactly one active machine
    if (machines.length === 1) {
      return {
        machineId: machines[0].id,
        machineLabel: machines[0].instance_code + (machines[0].serial_number ? ` (${machines[0].serial_number})` : ''),
        confidence: 0.05,
        discrepancies: [],
      }
    }
    return { confidence: 0, discrepancies: [] }
  }

  // Try matching hints against machines
  for (const hint of hints) {
    const lowerHint = hint.toLowerCase()

    // Exact serial_number match
    const serialMatch = machines.find((m: any) => m.serial_number?.toLowerCase() === lowerHint)
    if (serialMatch) {
      return {
        machineId: serialMatch.id,
        machineLabel: serialMatch.instance_code + (serialMatch.serial_number ? ` (${serialMatch.serial_number})` : ''),
        confidence: 0.25,
        discrepancies: [],
      }
    }

    // Exact instance_code match
    const codeMatch = machines.find((m: any) => m.instance_code?.toLowerCase() === lowerHint)
    if (codeMatch) {
      return {
        machineId: codeMatch.id,
        machineLabel: codeMatch.instance_code + (codeMatch.serial_number ? ` (${codeMatch.serial_number})` : ''),
        confidence: 0.25,
        discrepancies: [],
      }
    }
  }

  // Fuzzy catalog match: check model_code / machine_family
  const catalogIds = [...new Set(machines.filter((m: any) => m.catalog_product_id).map((m: any) => m.catalog_product_id))]
  if (catalogIds.length > 0) {
    const profiles = await knex('machine_catalog_profiles')
      .select('id', 'model_code', 'machine_family')
      .whereIn('id', catalogIds)

    for (const hint of hints) {
      const lowerHint = hint.toLowerCase()
      const matchingProfiles = profiles.filter(
        (p: any) =>
          p.model_code?.toLowerCase() === lowerHint ||
          p.machine_family?.toLowerCase() === lowerHint,
      )

      if (matchingProfiles.length > 0) {
        const matchingProfileIds = new Set(matchingProfiles.map((p: any) => p.id))
        const matchingMachines = machines.filter((m: any) => matchingProfileIds.has(m.catalog_product_id))

        if (matchingMachines.length === 1) {
          return {
            machineId: matchingMachines[0].id,
            machineLabel: matchingMachines[0].instance_code + (matchingMachines[0].serial_number ? ` (${matchingMachines[0].serial_number})` : ''),
            confidence: 0.1,
            discrepancies: [],
          }
        }
      }
    }
  }

  // No match
  return {
    confidence: 0,
    discrepancies: [{ type: 'machine_not_found', message: `Could not match machine hints: ${hints.join(', ')}` }],
  }
}

// --- Confidence assembly ---

export function assembleConfidence(llmConfidence: number, matchingSignals: number): number {
  return Math.min(1.0, llmConfidence * 0.5 + matchingSignals)
}

// --- normalizePayload ---

async function normalizePayload(
  payload: Record<string, unknown>,
  ctx: InboxActionExecutionContext,
): Promise<Record<string, unknown>> {
  const knex = (ctx.container as any).resolve('knex')
  const organizationId = ctx.organizationId
  const discrepancies: Discrepancy[] = []
  let matchingSignals = 0

  // Customer resolution
  const customerResult = await resolveCustomer(payload, knex, organizationId)
  if (customerResult.customerId) {
    payload.customer_entity_id = customerResult.customerId
    payload._customer_name = customerResult.customerName
  }
  matchingSignals += customerResult.confidence
  discrepancies.push(...customerResult.discrepancies)

  // Machine resolution (only if customer resolved)
  if (customerResult.customerId) {
    const machineResult = await resolveMachine(payload, knex, customerResult.customerId, organizationId)
    if (machineResult.machineId) {
      payload.machine_instance_id = machineResult.machineId
      payload._machine_label = machineResult.machineLabel
    }
    matchingSignals += machineResult.confidence
    discrepancies.push(...machineResult.discrepancies)
  }

  // Confidence assembly
  const llmConfidence = typeof payload._llm_confidence === 'number' ? payload._llm_confidence : 0.5
  payload._confidence = assembleConfidence(llmConfidence, matchingSignals)
  payload._discrepancies = discrepancies

  return payload
}

// --- Prompt schema & rules ---

const promptSchema = `{
  "customer_email": "string (email) — sender email address",
  "customer_name": "string — sender display name",
  "machine_hints": ["string"] — any machine identifiers mentioned (serial numbers, model codes, machine names),
  "service_type": "commissioning | regular | warranty_claim | maintenance",
  "priority": "normal | urgent | critical",
  "description": "string — 1-3 sentence summary of the service request",
  "address": "string — site/location address if mentioned"
}`

const promptRules = [
  'Propose create_service_ticket when the email is about: machine problems, breakdowns, equipment failures, maintenance requests, commissioning, warranty issues, on-site technical service, installation, or repair.',
  'Do NOT propose create_service_ticket for: sales inquiries, order requests, pricing questions, product catalog questions, general business correspondence, or complaints unrelated to machine/equipment service.',
  'Infer service_type from keywords: "commissioning"/"installation"/"setup" → commissioning; "warranty"/"guarantee"/"claim" → warranty_claim; "maintenance"/"checkup"/"scheduled"/"preventive"/"annual" → maintenance; all other service requests → regular.',
  'Infer priority from urgency signals: "production stopped"/"urgent"/"ASAP"/"critical"/"emergency"/"blocked" → urgent or critical; "scheduled"/"planned"/"next visit"/"when convenient" → normal.',
  'Extract machine_hints as an array of any machine identifiers mentioned in the email: serial numbers, model codes, machine names, asset codes. Include partial matches.',
  'Write description as a 1-3 sentence summary of the service issue. Do not copy the full email body.',
]

// --- Action definition ---

export const inboxActions: InboxActionDefinition[] = [
  {
    type: 'create_service_ticket',
    requiredFeature: 'service_tickets.create',
    payloadSchema: createServiceTicketPayloadSchema,
    label: 'Create Service Ticket',
    promptSchema,
    promptRules,
    normalizePayload,
    execute: async (_action, _ctx) => {
      // Prefill-only: ticket creation happens through the UI form.
      // The proposal detail page handles sessionStorage + navigation.
      return {}
    },
  },
]

export default inboxActions
