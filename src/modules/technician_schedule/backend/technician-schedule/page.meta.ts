import React from 'react'
import { CalendarDays } from 'lucide-react'

const technicianScheduleIcon = React.createElement(CalendarDays, { className: 'size-4' })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['technician_schedule.view'],
  pageTitle: 'Technician schedule',
  pageTitleKey: 'technicianSchedule.page.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 31,
  icon: technicianScheduleIcon,
  breadcrumb: [{ label: 'Technician schedule', labelKey: 'technicianSchedule.page.title' }],
}

