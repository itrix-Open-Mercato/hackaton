export const metadata = {
  requireAuth: true,
  requireFeatures: ['field_technicians.manage'],
  navHidden: true,
  pageTitle: 'New technician',
  pageTitleKey: 'fieldTechnicians.create.title',
  breadcrumb: [
    { label: 'Technicians', labelKey: 'fieldTechnicians.page.title', href: '/backend/field-technicians' },
    { label: 'New technician', labelKey: 'fieldTechnicians.create.title' },
  ],
}
