import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M12 20v2' }),
  React.createElement('path', { d: 'M12 2v2' }),
  React.createElement('path', { d: 'M17 20v2' }),
  React.createElement('path', { d: 'M17 2v2' }),
  React.createElement('path', { d: 'M2 12h2' }),
  React.createElement('path', { d: 'M2 17h2' }),
  React.createElement('path', { d: 'M2 7h2' }),
  React.createElement('path', { d: 'M20 12h2' }),
  React.createElement('path', { d: 'M20 17h2' }),
  React.createElement('path', { d: 'M20 7h2' }),
  React.createElement('path', { d: 'M7 20v2' }),
  React.createElement('path', { d: 'M7 2v2' }),
  React.createElement('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
  React.createElement('rect', { x: '8', y: '8', width: '8', height: '8', rx: '1' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['machine_instances.view'],
  pageTitle: 'Machine Instances',
  pageTitleKey: 'machine_instances.page.title',
  pageGroup: 'Machines',
  pageGroupKey: 'machine_instances.nav.group',
  pageOrder: 40,
  icon,
  breadcrumb: [{ label: 'Machine Instances', labelKey: 'machine_instances.page.title' }],
}
