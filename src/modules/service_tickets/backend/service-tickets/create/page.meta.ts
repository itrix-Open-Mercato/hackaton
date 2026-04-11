export const metadata = {
  requireAuth: true,
  requireFeatures: ['service_tickets.create'],
  pageTitle: 'Create Service Ticket',
  pageTitleKey: 'service_tickets.form.create.title',
  pageGroup: 'Service',
  pageGroupKey: 'service_tickets.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Service Tickets', labelKey: 'service_tickets.page.title', href: '/backend/service-tickets' },
    { label: 'Create', labelKey: 'service_tickets.form.create.title' },
  ],
}
