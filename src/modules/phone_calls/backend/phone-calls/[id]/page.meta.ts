export const metadata = {
  requireAuth: true,
  requireFeatures: ['integrations.view'],
  pageTitle: 'Phone Call',
  pageTitleKey: 'phone_calls.detail.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Phone Calls', labelKey: 'phone_calls.page.title', href: '/backend/phone-calls' },
    { label: 'Phone Call', labelKey: 'phone_calls.detail.title' },
  ],
}
