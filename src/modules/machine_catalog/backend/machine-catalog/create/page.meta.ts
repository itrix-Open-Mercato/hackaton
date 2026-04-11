export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_catalog.manage'],
  pageTitle: 'New Machine Profile',
  pageTitleKey: 'machine_catalog.create.title',
  pageGroup: 'Machines',
  pageGroupKey: 'machines.nav.group',
  breadcrumb: [
    { label: 'Machine Catalog', labelKey: 'machine_catalog.page.title', href: '/backend/machine-catalog' },
    { label: 'New', labelKey: 'machine_catalog.create.title' },
  ],
}
