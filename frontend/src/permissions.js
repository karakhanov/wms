const ROLES = { admin: 'admin', manager: 'manager', storekeeper: 'storekeeper', foreman: 'foreman' }

export function getRole(user) {
  if (!user) return null
  if (user.rbac?.role) return user.rbac.role
  if (user.role_name) return user.role_name
  if (typeof user.role === 'object' && user.role?.name) return user.role.name
  return user.role ?? null
}

export function isAdmin(user) {
  return Boolean(user?.is_superuser) || getRole(user) === ROLES.admin
}

export function isManager(user) {
  return getRole(user) === ROLES.manager
}

export function isStorekeeper(user) {
  return getRole(user) === ROLES.storekeeper
}

export function isForeman(user) {
  return getRole(user) === ROLES.foreman
}

function canByRbac(user, resource, action) {
  const flag = action === 'write' ? 'can_write' : 'can_read'
  const permissions = user?.rbac?.permissions
  if (!permissions || !permissions[resource]) return null
  return Boolean(permissions[resource][flag])
}

function withFallback(user, resource, action, fallback) {
  const byRbac = canByRbac(user, resource, action)
  if (byRbac !== null) return byRbac
  return fallback()
}

export function canViewSidebar(user, navKey, fallback = true) {
  return withFallback(user, `sidebar_${navKey}`, 'read', () => {
    if (typeof fallback === 'function') return fallback()
    return Boolean(fallback)
  })
}

/** Товары: создание, редактирование, удаление — Администратор, Менеджер */
export function canManageProducts(user) {
  return withFallback(user, 'products', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

/** Категории: CRUD — Администратор, Менеджер */
export function canManageCategories(user) {
  return withFallback(user, 'categories', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

/** Поставщики: CRUD — Администратор, Менеджер */
export function canManageSuppliers(user) {
  return withFallback(user, 'suppliers', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

/** Склад (зоны, стеллажи, ячейки): Администратор, Менеджер */
export function canManageWarehouse(user) {
  return withFallback(user, 'warehouse', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

export function canViewConstructionObjects(user) {
  return withFallback(user, 'construction_objects', 'read', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager || r === ROLES.foreman
  })
}

export function canManageConstructionObjects(user) {
  return withFallback(user, 'construction_objects', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

/** Приёмка: создание — Менеджер, Кладовщик */
export function canCreateReceipt(user) {
  return withFallback(user, 'receipts', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
  })
}

/** Заказы: создание, смена статуса — Менеджер, Кладовщик */
export function canManageOrders(user) {
  return withFallback(user, 'orders', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
  })
}

/** Перемещение: создание — Кладовщик, Менеджер */
export function canCreateTransfer(user) {
  return withFallback(user, 'transfers', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.storekeeper
  })
}

/** Инвентаризация: создание, применение — Кладовщик, Администратор */
export function canManageInventory(user) {
  return withFallback(user, 'inventory', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.storekeeper
  })
}

/** Пользователи: просмотр и создание — Администратор, Менеджер; удаление — только Администратор */
export function canViewUsers(user) {
  return withFallback(user, 'users', 'read', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

export function canCreateUser(user) {
  return canViewUsers(user)
}

export function canManageRoles(user) {
  return isAdmin(user)
}

export function canDeleteUser(user) {
  return isAdmin(user)
}

export function canViewReports(user) {
  return withFallback(user, 'reports', 'read', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager
  })
}

export function canViewIssueNotes(user) {
  return withFallback(user, 'issue_notes', 'read', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper || r === ROLES.foreman
  })
}

export function canViewNotifications(user) {
  return withFallback(user, 'notifications', 'read', () => Boolean(getRole(user)))
}

export function canViewHistory(user) {
  return withFallback(user, 'action_log', 'read', () => Boolean(getRole(user)))
}

export function canManageIssueNotes(user) {
  return withFallback(user, 'issue_notes', 'write', () => {
    const r = getRole(user)
    return r === ROLES.admin || r === ROLES.manager || r === ROLES.foreman
  })
}

export function canCreateIssueNotes(user) {
  const r = getRole(user)
  return r === ROLES.foreman
}

export function canApproveIssueNotes(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}
