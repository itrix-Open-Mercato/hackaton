import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'
import { FIELD_TECHNICIAN_ENTITY_TYPE } from './lib/crud'

function asSearchText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: FIELD_TECHNICIAN_ENTITY_TYPE,
      enabled: true,
      priority: 8,
      fieldPolicy: {
        searchable: [
          'display_name',
          'displayName',
          'first_name',
          'firstName',
          'last_name',
          'lastName',
          'email',
          'phone',
        ],
      },
      buildSource: async (ctx) => {
        const record = ctx.record
        const displayName = asSearchText(record.display_name ?? record.displayName)
        const first = asSearchText(record.first_name ?? record.firstName)
        const last = asSearchText(record.last_name ?? record.lastName)
        const email = asSearchText(record.email)
        const phone = asSearchText(record.phone)
        const nameLine = displayName || [first, last].filter(Boolean).join(' ').trim()
        const text = [nameLine, email, phone].filter((line) => line.length > 0)
        return {
          text: text.length ? text : [nameLine || 'Technician'],
          presenter: {
            title: nameLine || 'Technician',
            subtitle: email || phone || undefined,
            icon: 'lucide:wrench',
          },
          checksumSource: { record: ctx.record, customFields: ctx.customFields },
        }
      },
      formatResult: async (ctx) => {
        const record = ctx.record
        const displayName = asSearchText(record.display_name ?? record.displayName)
        const first = asSearchText(record.first_name ?? record.firstName)
        const last = asSearchText(record.last_name ?? record.lastName)
        const email = asSearchText(record.email)
        const phone = asSearchText(record.phone)
        const title = displayName || [first, last].filter(Boolean).join(' ').trim() || 'Technician'
        return {
          title,
          subtitle: email || phone || undefined,
          icon: 'lucide:wrench',
        }
      },
      resolveUrl: async (ctx) => {
        const id = ctx.record.id
        if (id == null) return null
        return `/backend/field-technicians/${encodeURIComponent(String(id))}`
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
