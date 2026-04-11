import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M5 7a2 2 0 0 0-2 2v11' }),
  React.createElement('path', { d: 'M5.803 18H5a2 2 0 0 0 0 4h9.5a.5.5 0 0 0 .5-.5V21' }),
  React.createElement('path', { d: 'M9 15V4a2 2 0 0 1 2-2h9.5a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H11a2 2 0 0 1 0-4h10' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_catalog.view'],
  pageTitle: 'Machine Catalog',
  pageTitleKey: 'machine_catalog.page.title',
  pageGroup: 'Machines',
  pageGroupKey: 'machines.nav.group',
  pageOrder: 41,
  icon,
  breadcrumb: [{ label: 'Machine Catalog', labelKey: 'machine_catalog.page.title' }],
}
