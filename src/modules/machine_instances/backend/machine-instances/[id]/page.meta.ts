export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_instances.manage'],
  pageTitle: 'Edit Machine Instance',
  pageTitleKey: 'machine_instances.edit.title',
  breadcrumb: [
    { label: 'Machine Instances', labelKey: 'machine_instances.page.title', href: '/backend/machine-instances' },
    { label: 'Edit', labelKey: 'machine_instances.edit.title' },
  ],
}
