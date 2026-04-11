import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

// Inject machine profile tab into catalog product detail pages
// Support both legacy and current spot ID aliases
export const injectionTable: ModuleInjectionTable = {
  'catalog.product.detail:tabs': [
    {
      widgetId: 'machine_catalog.injection.catalog-product-machine-profile',
      kind: 'tab',
      groupLabel: 'machine_catalog.widget.tabLabel',
      priority: 20,
    },
  ],
  'catalog.catalog_product.detail:tabs': [
    {
      widgetId: 'machine_catalog.injection.catalog-product-machine-profile',
      kind: 'tab',
      groupLabel: 'machine_catalog.widget.tabLabel',
      priority: 20,
    },
  ],
}

export default injectionTable
