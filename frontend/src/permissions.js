/**
 * Права по ролям: admin, manager, storekeeper.
 * Товары и категории: Администратор, Менеджер.
 * Поставщики: Администратор, Менеджер.
 * Приёмка, отгрузка, перемещение: Менеджер, Кладовщик.
 * Инвентаризация: Кладовщик, Администратор.
 * Отчёты: Менеджер, Администратор.
 * Пользователи: Администратор, Менеджер (создание/просмотр); удаление/смена роли — только Администратор.
 */

const ROLES = { admin: 'admin', manager: 'manager', storekeeper: 'storekeeper' }

export function getRole(user) {
  if (!user) return null
  if (user.role_name) return user.role_name
  if (typeof user.role === 'object' && user.role?.name) return user.role.name
  return user.role ?? null
}

export function isAdmin(user) {
  return getRole(user) === ROLES.admin
}

export function isManager(user) {
  return getRole(user) === ROLES.manager
}

export function isStorekeeper(user) {
  return getRole(user) === ROLES.storekeeper
}

/** Товары: создание, редактирование, удаление — Администратор, Менеджер */
export function canManageProducts(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}

/** Категории: CRUD — Администратор, Менеджер */
export function canManageCategories(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}

/** Поставщики: CRUD — Администратор, Менеджер */
export function canManageSuppliers(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}

/** Склад (зоны, стеллажи, ячейки): Администратор, Менеджер */
export function canManageWarehouse(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}

/** Приёмка: создание — Менеджер, Кладовщик */
export function canCreateReceipt(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
}

/** Заказы: создание, смена статуса — Менеджер, Кладовщик */
export function canManageOrders(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
}

/** Перемещение: создание — Кладовщик, Менеджер */
export function canCreateTransfer(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
}

/** Инвентаризация: создание, применение — Кладовщик, Администратор */
export function canManageInventory(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager || r === ROLES.storekeeper
}

/** Пользователи: просмотр и создание — Администратор, Менеджер; удаление — только Администратор */
export function canViewUsers(user) {
  const r = getRole(user)
  return r === ROLES.admin || r === ROLES.manager
}

export function canCreateUser(user) {
  return canViewUsers(user)
}

export function canDeleteUser(user) {
  return isAdmin(user)
}
