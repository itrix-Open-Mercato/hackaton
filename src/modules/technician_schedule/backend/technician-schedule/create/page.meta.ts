export const metadata = {
  requireAuth: true,
  requireFeatures: ['technician_schedule.manage'],
  pageTitle: 'New reservation',
  pageTitleKey: 'technicianSchedule.form.create.title',
  navHidden: true,
  breadcrumb: [
    { label: 'Technician schedule', labelKey: 'technicianSchedule.page.title', href: '/backend/technician-schedule' },
    { label: 'New reservation', labelKey: 'technicianSchedule.form.create.title' },
  ],
}

