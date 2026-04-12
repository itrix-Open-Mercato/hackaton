export const metadata = {
  requireAuth: true,
  requireFeatures: ['integrations.manage'],
  pageTitle: 'Phone Call Operations',
  pageTitleKey: 'phone_calls.operations.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Phone Calls', labelKey: 'phone_calls.page.title', href: '/backend/phone-calls' },
    { label: 'Operations', labelKey: 'phone_calls.operations.breadcrumb' },
  ],
}
