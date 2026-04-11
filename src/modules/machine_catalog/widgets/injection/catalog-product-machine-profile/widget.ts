import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import MachineCatalogProfileWidget from './widget.client'

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'machine_catalog.injection.catalog-product-machine-profile',
    title: 'Machine Profile',
    description: 'Shows machine catalog profile and service kit templates for this catalog product.',
    priority: 20,
    enabled: true,
    features: ['machine_catalog.view'],
  },
  Widget: MachineCatalogProfileWidget,
}

export default widget
