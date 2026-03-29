const ROLES = {
  admin: 'admin',
  manager: 'manager',
  storekeeper: 'storekeeper',
  foreman: 'foreman',
  procurement: 'procurement',
  warehouse_controller: 'warehouse_controller',
}

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

export function isProcurement(user) {
  return getRole(user) === ROLES.procurement
}

export function isWarehouseController(user) {
  return getRole(user) === ROLES.warehouse_controller
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

/** Красная подсветка нехватки в списке, подсказки и блок «Остатки по товарам» в карточке накладной */
export function canViewIssueNoteShortageHints(user) {
  return isAdmin(user) || isManager(user) || isProcurement(user)
}

export function canViewIssueNotes(user) {
  return withFallback(user, 'issue_notes', 'read', () => {
    const r = getRole(user)
    return (
      r === ROLES.admin ||
      r === ROLES.manager ||
      r === ROLES.storekeeper ||
      r === ROLES.foreman ||
      r === ROLES.procurement ||
      r === ROLES.warehouse_controller
    )
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
  if (r !== ROLES.admin && r !== ROLES.manager) return false
  return withFallback(user, 'issue_notes', 'write', () => true)
}

export function canSendIssueNoteToProcurement(user) {
  return canApproveIssueNotes(user)
}

/** Операции снабжения по накладной (взять в закупку, отказ, приход, реквизиты) — только роль снабжения; админ — полный доступ */
export function canProcurementIssueNote(user) {
  if (!isProcurement(user) && !isAdmin(user)) return false
  return withFallback(user, 'issue_notes', 'write', () => true)
}

/** Приёмка накладной — контролёр или админ (не менеджер) */
export function canControllerIssueNote(user) {
  if (!isWarehouseController(user) && !isAdmin(user)) return false
  return withFallback(user, 'issue_notes', 'write', () => true)
}

/**
 * Сборка и «Готов к выдаче»: кладовщик (достаточно права чтения накладных — без write кнопка не должна пропадать),
 * менеджер и админ — как на схеме «одобрил → склад собирает».
 */
export function canStorekeeperIssueNoteFlow(user) {
  if (isStorekeeper(user)) {
    return withFallback(user, 'issue_notes', 'read', () => true)
  }
  if (isAdmin(user) || user?.is_superuser || isManager(user)) {
    return withFallback(user, 'issue_notes', 'write', () => true)
  }
  return false
}

/** Прораб (роль); для кнопки «Получил» см. canForemanConfirmIssueNote */
export function canForemanConfirmIssueReceipt(user) {
  return isForeman(user)
}

/** Одобрение накладной на бэкенде списывает остатки — скрываем кнопку при известной нехватке */
export function issueNoteApproveBlockedByShortage(note, shortageById) {
  if (!note?.id || !shortageById) return false
  return Boolean(shortageById[String(note.id)])
}

export function canShowIssueNoteApproveButton(user, note, shortageById, canSeeShortageHints) {
  if (!canApproveIssueNotes(user) || !note) return false
  if (note.status !== 'submitted' && note.status !== 'awaiting_release') return false
  if (canSeeShortageHints && issueNoteApproveBlockedByShortage(note, shortageById)) return false
  return true
}

/** Соответствует проверке приёмки на бэкенде (назначенный контролёр / админ / legacy) */
export function canUserInspectIssueNote(user, note) {
  if (!user || !note) return false
  if (user.is_superuser) return true
  if (isAdmin(user)) return true
  if (!isWarehouseController(user)) return false
  const ids = note.inspection_invited_user_ids
  if (!Array.isArray(ids) || ids.length === 0) return true
  const uid = Number(user.id)
  if (!Number.isFinite(uid)) return false
  return ids.map((x) => Number(x)).includes(uid)
}

/** Прораб может подтвердить только свою накладную */
export function canForemanConfirmIssueNote(user, note) {
  if (!isForeman(user) || !note) return false
  const uid = Number(user.id)
  const created = note.created_by
  if (created == null || created === '') return false
  const cid = typeof created === 'object' && created !== null ? Number(created.id) : Number(created)
  return Number.isFinite(cid) && cid === uid
}
