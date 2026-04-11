import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'

export const menuItems = [
  {
    id: 'technicians-list',
    labelKey: 'technicians.page.title',
    icon: 'lucide:hard-hat',
    href: '/backend/technicians',
    placement: { position: InjectionPosition.After, relativeTo: 'service-tickets' },
  },
]
