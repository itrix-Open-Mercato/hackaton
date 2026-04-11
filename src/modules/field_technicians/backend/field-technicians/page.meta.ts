import React from 'react'
import { Wrench } from 'lucide-react'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['field_technicians.view'],
  pageTitle: 'Technicians',
  pageTitleKey: 'fieldTechnicians.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'fieldTechnicians.nav.group',
  pageOrder: 30,
  icon: React.createElement(Wrench, { className: 'size-4' }),
  breadcrumb: [{ label: 'Technicians', labelKey: 'fieldTechnicians.page.title' }],
}
