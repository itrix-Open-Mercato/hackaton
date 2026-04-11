import React from 'react'
import { Wrench } from 'lucide-react'

const serviceTicketsIcon = React.createElement(Wrench, { size: 16 })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['service_tickets.view'],
  pageTitle: 'Service Tickets',
  pageTitleKey: 'service_tickets.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 200,
  icon: serviceTicketsIcon,
  breadcrumb: [
    { label: 'Service Tickets', labelKey: 'service_tickets.page.title' },
  ],
}
