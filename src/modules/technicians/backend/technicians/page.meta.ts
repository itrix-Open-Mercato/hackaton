import React from 'react'
import { HardHat } from 'lucide-react'

const techniciansIcon = React.createElement(HardHat, { size: 16 })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['technicians.view'],
  pageTitle: 'Technicians',
  pageTitleKey: 'technicians.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 210,
  icon: techniciansIcon,
  breadcrumb: [
    { label: 'Technicians', labelKey: 'technicians.page.title' },
  ],
}
