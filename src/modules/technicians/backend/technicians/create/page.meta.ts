export const metadata = {
  requireAuth: true,
  requireFeatures: ['technicians.create'],
  pageTitle: 'Create Technician',
  pageTitleKey: 'technicians.form.create.title',
  pageGroup: 'Service',
  pageGroupKey: 'technicians.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Technicians', labelKey: 'technicians.page.title', href: '/backend/technicians' },
    { label: 'Create', labelKey: 'technicians.form.create.title' },
  ],
}
