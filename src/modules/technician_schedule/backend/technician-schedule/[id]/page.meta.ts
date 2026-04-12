export const metadata = {
  requireAuth: true,
  requireFeatures: ['technician_schedule.manage'],
  pageTitle: 'Edit reservation',
  pageTitleKey: 'technicianSchedule.form.edit.title',
  navHidden: true,
  breadcrumb: [
    { label: 'Technician schedule', labelKey: 'technicianSchedule.page.title', href: '/backend/technician-schedule' },
    { label: 'Edit reservation', labelKey: 'technicianSchedule.form.edit.title' },
  ],
}

