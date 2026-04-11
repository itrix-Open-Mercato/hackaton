export const metadata = {
  requireAuth: true,
  requireFeatures: ['field_technicians.view'],
  pageTitle: 'Technician card',
  pageTitleKey: 'fieldTechnicians.detail.title',
  breadcrumb: [
    { label: 'Technicians', labelKey: 'fieldTechnicians.page.title', href: '/backend/field-technicians' },
    { label: 'Technician card', labelKey: 'fieldTechnicians.detail.title' },
  ],
}
