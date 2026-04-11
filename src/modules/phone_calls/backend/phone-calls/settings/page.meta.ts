export const metadata = {
  requireAuth: true,
  requireFeatures: ['integrations.manage'],
  pageTitle: 'Phone Call Settings',
  pageTitleKey: 'phone_calls.settings.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  pageOrder: 191,
  breadcrumb: [
    { label: 'Phone Calls', labelKey: 'phone_calls.page.title', href: '/backend/phone-calls' },
    { label: 'Settings', labelKey: 'phone_calls.settings.breadcrumb' },
  ],
}
