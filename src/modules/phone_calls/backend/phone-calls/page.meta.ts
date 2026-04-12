import React from 'react'
import { PhoneCall } from 'lucide-react'

const phoneCallsIcon = React.createElement(PhoneCall, { size: 16 })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['integrations.view'],
  pageTitle: 'Phone Calls',
  pageTitleKey: 'phone_calls.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 190,
  icon: phoneCallsIcon,
  breadcrumb: [
    { label: 'Phone Calls', labelKey: 'phone_calls.page.title' },
  ],
}
