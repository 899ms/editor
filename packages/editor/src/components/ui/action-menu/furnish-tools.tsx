import type { CatalogCategory } from './../../../store/use-editor'

export type FurnishToolConfig = {
  id: 'item'
  iconSrc: string
  label: string
  labelKey: string
  catalogCategory: CatalogCategory
}

export const furnishTools: FurnishToolConfig[] = [
  {
    id: 'item',
    iconSrc: '/icons/couch.webp',
    label: 'Furniture',
    labelKey: 'itemCatalog.categories.furniture',
    catalogCategory: 'furniture',
  },
  {
    id: 'item',
    iconSrc: '/icons/appliance.webp',
    label: 'Appliance',
    labelKey: 'itemCatalog.categories.appliance',
    catalogCategory: 'appliance',
  },
  {
    id: 'item',
    iconSrc: '/icons/kitchen.webp',
    label: 'Kitchen',
    labelKey: 'itemCatalog.categories.kitchen',
    catalogCategory: 'kitchen',
  },
  {
    id: 'item',
    iconSrc: '/icons/bathroom.webp',
    label: 'Bathroom',
    labelKey: 'itemCatalog.categories.bathroom',
    catalogCategory: 'bathroom',
  },
  {
    id: 'item',
    iconSrc: '/icons/tree.webp',
    label: 'Outdoor',
    labelKey: 'itemCatalog.categories.outdoor',
    catalogCategory: 'outdoor',
  },
]
