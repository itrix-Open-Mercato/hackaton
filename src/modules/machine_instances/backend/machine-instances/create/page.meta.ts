export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_instances.manage'],
  pageTitle: 'New Machine Instance',
  pageTitleKey: 'machine_instances.create.title',
  pageGroup: 'Machines',
  pageGroupKey: 'machines.nav.group',
  breadcrumb: [
    { label: 'Machine Instances', labelKey: 'machine_instances.page.title', href: '/backend/machine-instances' },
    { label: 'New', labelKey: 'machine_instances.create.title' },
  ],
}
