export const metadata = {
  requireAuth: true,
  requireFeatures: ['technicians.edit'],
  pageTitle: 'Edit Technician',
  pageTitleKey: 'technicians.form.edit.title',
  pageGroup: 'Service',
  pageGroupKey: 'technicians.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Technicians', labelKey: 'technicians.page.title', href: '/backend/technicians' },
    { label: 'Edit', labelKey: 'technicians.form.edit.title' },
  ],
}
