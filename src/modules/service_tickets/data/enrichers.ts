import type { ResponseEnricher, EnricherContext } from '@open-mercato/shared/lib/crud/response-enricher'

type TicketRecord = Record<string, unknown> & { id: string }

type CompanyNameEnrichment = {
  _service_tickets: {
    companyName: string | null
  }
}

const companyNameEnricher: ResponseEnricher<TicketRecord, CompanyNameEnrichment> = {
  id: 'service_tickets.company-name',
  targetEntity: 'service_tickets.ticket',
  priority: 10,
  timeout: 2000,
  fallback: {
    _service_tickets: { companyName: null },
  },

  async enrichOne(record, context) {
    const customerEntityId = (record.customerEntityId ?? record.customer_entity_id) as string | null
    if (!customerEntityId) {
      return { ...record, _service_tickets: { companyName: null } }
    }

    const em = (context.em as any).fork()
    const knex = em.getConnection().getKnex()
    const [row] = await knex('customer_entities')
      .select('display_name')
      .where({ id: customerEntityId, organization_id: context.organizationId, tenant_id: context.tenantId })
      .limit(1)

    return {
      ...record,
      _service_tickets: { companyName: (row?.display_name as string) ?? null },
    }
  },

  async enrichMany(records, context) {
    const customerEntityIds = [
      ...new Set(
        records
          .map((r) => (r.customerEntityId ?? r.customer_entity_id) as string | null)
          .filter((id): id is string => !!id),
      ),
    ]

    if (customerEntityIds.length === 0) {
      return records.map((record) => ({
        ...record,
        _service_tickets: { companyName: null },
      }))
    }

    const em = (context.em as any).fork()
    const knex = em.getConnection().getKnex()
    const rows: { id: string; display_name: string }[] = await knex('customer_entities')
      .select('id', 'display_name')
      .whereIn('id', customerEntityIds)
      .andWhere({ organization_id: context.organizationId, tenant_id: context.tenantId })

    const nameMap = new Map(rows.map((row) => [row.id, row.display_name]))

    return records.map((record) => {
      const customerEntityId = (record.customerEntityId ?? record.customer_entity_id) as string | null
      return {
        ...record,
        _service_tickets: {
          companyName: customerEntityId ? (nameMap.get(customerEntityId) ?? null) : null,
        },
      }
    })
  },
}

export const enrichers: ResponseEnricher[] = [companyNameEnricher]
