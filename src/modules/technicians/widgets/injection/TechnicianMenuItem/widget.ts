import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'technicians.injection.TechnicianMenuItem',
  },
  menuItems: [
    {
      id: 'technicians-list',
      labelKey: 'technicians.page.title',
      label: 'Technicians',
      icon: 'HardHat',
      href: '/backend/technicians',
      features: ['technicians.view'],
      placement: { position: InjectionPosition.After, relativeTo: 'service-tickets' },
    },
  ],
}

export default widget
