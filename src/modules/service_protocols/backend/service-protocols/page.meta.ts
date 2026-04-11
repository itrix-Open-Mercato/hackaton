import React from 'react'
import { ClipboardList } from 'lucide-react'

const icon = React.createElement(ClipboardList, { size: 16 })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['service_protocols.view'],
  pageTitle: 'Service Protocols',
  pageTitleKey: 'service_protocols.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 210,
  icon,
  breadcrumb: [
    { label: 'Service Protocols', labelKey: 'service_protocols.page.title' },
  ],
}
