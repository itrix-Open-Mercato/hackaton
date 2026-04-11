export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_catalog.manage'],
  pageTitle: 'Edit Machine Profile',
  pageTitleKey: 'machine_catalog.edit.title',
  breadcrumb: [
    { label: 'Machine Catalog', labelKey: 'machine_catalog.page.title', href: '/backend/machine-catalog' },
    { label: 'Edit', labelKey: 'machine_catalog.edit.title' },
  ],
}
