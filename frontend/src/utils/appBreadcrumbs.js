/**
 * Маршруты для хлебных крошек: первое совпадение (регэкспы от более специфичных к общим).
 */
const ROUTE_DEFS = [
  { re: /^\/products\/\d+/, navKey: 'products', group: 'group2', detail: true },
  { re: /^\/products\/?$/, navKey: 'products', group: 'group2' },
  { re: /^\/object-types\/new\/?$/, navKey: 'objectTypes', group: 'group3', detail: true },
  { re: /^\/object-types\/\d+\/edit\/?$/, navKey: 'objectTypes', group: 'group3', detail: true },
  { re: /^\/object-types\/\d+\/?$/, navKey: 'objectTypes', group: 'group3', detail: true },
  { re: /^\/object-types\/?$/, navKey: 'objectTypes', group: 'group3' },
  { re: /^\/objects\/new\/?$/, navKey: 'objects', group: 'group3', detail: true },
  { re: /^\/objects\/\d+\/edit\/?$/, navKey: 'objects', group: 'group3', detail: true },
  { re: /^\/objects\/\d+\/?$/, navKey: 'objects', group: 'group3', detail: true },
  { re: /^\/objects\/?$/, navKey: 'objects', group: 'group3' },
  { re: /^\/categories\/?$/, navKey: 'categories', group: 'group2' },
  { re: /^\/suppliers\/?$/, navKey: 'suppliers', group: 'group2' },
  { re: /^\/services\/?$/, navKey: 'services', group: 'group2' },
  { re: /^\/warehouse\/?$/, navKey: 'warehouse', group: 'group2' },
  { re: /^\/stock\/?$/, navKey: 'stock', group: 'group2' },
  { re: /^\/receipts\/?$/, navKey: 'receipts', group: 'group4' },
  { re: /^\/orders\/?$/, navKey: 'orders', group: 'group4' },
  { re: /^\/issue-notes\/?$/, navKey: 'issueNotes', group: 'group4' },
  { re: /^\/transfers\/?$/, navKey: 'transfers', group: 'group5' },
  { re: /^\/inventory\/?$/, navKey: 'inventory', group: 'group5' },
  { re: /^\/reports\/?$/, navKey: 'reports', group: 'group6' },
  { re: /^\/users\/?$/, navKey: 'users', group: 'group7' },
  { re: /^\/roles-access\/?$/, navKey: 'rolesAccess', group: 'group7' },
  { re: /^\/notifications\/?$/, navKey: 'notifications', group: 'group7' },
  { re: /^\/history\/?$/, navKey: 'history', group: 'group7' },
  { re: /^\/object-limits\/?$/, navKey: 'objectLimits', group: 'group3' },
  { re: /^\/about\/?$/, navKey: 'about', group: null },
  { re: /^\/profile\/?$/, navKey: 'profilePage', group: null },
  { re: /^\/$/, navKey: 'dashboard', group: 'group1' },
]

const NAV_TO = {
  dashboard: '/',
  products: '/products',
  categories: '/categories',
  suppliers: '/suppliers',
  services: '/services',
  warehouse: '/warehouse',
  stock: '/stock',
  objects: '/objects',
  receipts: '/receipts',
  orders: '/orders',
  issueNotes: '/issue-notes',
  transfers: '/transfers',
  inventory: '/inventory',
  reports: '/reports',
  users: '/users',
  rolesAccess: '/roles-access',
  notifications: '/notifications',
  history: '/history',
  objectLimits: '/object-limits',
  objectTypes: '/object-types',
  about: '/about',
  profilePage: '/profile',
}

/**
 * @param {string} pathname
 * @param {(k: string) => string} t
 * @returns {{ to?: string, label: string, current?: boolean }[]}
 */
export function getBreadcrumbItems(pathname, t) {
  const path = pathname || '/'
  const norm = path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') || '/' : path

  const def = ROUTE_DEFS.find((d) => d.re.test(norm === '' ? '/' : norm))
  if (!def) {
    return [
      { to: '/', label: t('nav.dashboard') },
      { label: t('layout.breadcrumb.unknown'), current: true },
    ]
  }

  if (def.navKey === 'dashboard') {
    return [{ to: '/', label: t('nav.dashboard'), current: true }]
  }

  const items = []
  items.push({ to: '/', label: t('nav.dashboard') })

  if (def.group && def.group !== 'group1') {
    items.push({ label: t(`layout.navGroups.${def.group}`) })
  }

  const listTo = NAV_TO[def.navKey] || '/'

  if (def.detail) {
    items.push({ to: listTo, label: t(`nav.${def.navKey}`) })
    items.push({ label: t('layout.breadcrumb.details'), current: true })
  } else {
    items.push({ to: listTo, label: t(`nav.${def.navKey}`), current: true })
  }

  return items
}
