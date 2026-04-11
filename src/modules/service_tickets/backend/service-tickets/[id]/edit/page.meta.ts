export const metadata = {
  requireAuth: true,
  requireFeatures: ['service_tickets.edit'],
  pageTitle: 'Edit Service Ticket',
  pageTitleKey: 'service_tickets.form.edit.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Service Tickets', labelKey: 'service_tickets.page.title', href: '/backend/service-tickets' },
    { label: 'Edit', labelKey: 'service_tickets.form.edit.title' },
  ],
}
