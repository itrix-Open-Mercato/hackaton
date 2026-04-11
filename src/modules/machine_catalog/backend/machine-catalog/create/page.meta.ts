export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_catalog.manage'],
  pageTitle: 'New Machine Profile',
  pageTitleKey: 'machine_catalog.create.title',
  breadcrumb: [
    { label: 'Machine Catalog', labelKey: 'machine_catalog.page.title', href: '/backend/machine-catalog' },
    { label: 'New', labelKey: 'machine_catalog.create.title' },
  ],
}
