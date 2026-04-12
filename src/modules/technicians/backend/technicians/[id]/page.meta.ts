import React from 'react'
import { HardHat } from 'lucide-react'

const techniciansIcon = React.createElement(HardHat, { size: 16 })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['technicians.view'],
  pageTitle: 'Technician',
  pageTitleKey: 'technicians.detail.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  navHidden: true,
  icon: techniciansIcon,
  breadcrumb: [
    { label: 'Technicians', labelKey: 'technicians.page.title', href: '/backend/technicians' },
    { label: 'Technician', labelKey: 'technicians.detail.title' },
  ],
}
