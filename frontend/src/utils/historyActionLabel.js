/**
 * Разбор поля action журнала: middleware пишет "METHOD /path", отдельные события — коды вроде AUTH_LOGIN.
 * @param {string} action
 * @returns {{ kind: 'api', method: string, path: string } | { kind: 'code', code: string }}
 */
export function parseHistoryAction(action) {
  if (!action || typeof action !== 'string') return { kind: 'code', code: '' }
  const s = action.trim()
  const api = s.match(/^([A-Z]+)\s+(\S+)$/i)
  if (api) {
    return { kind: 'api', method: api[1].toUpperCase(), path: api[2] }
  }
  return { kind: 'code', code: s }
}

/** Путь вида .../123/ или .../123 — детальная сущность (не список). */
export function historyPathLooksLikeDetail(path) {
  if (!path) return false
  const p = path.replace(/\/+$/, '')
  return /\/\d+$/.test(p)
}

/**
 * Человекочитаемое действие для UI (без сырого API).
 * @param {Record<string, unknown>} row — строка action-log
 * @param {(k: string) => string} t — i18next t
 */
export function friendlyHistoryAction(row, t) {
  const a = row?.action
  if (!a) return t('common.none')
  if (a === 'AUTH_LOGIN') return t('history.authLogin')
  if (a === 'AUTH_LOGOUT') return t('history.authLogout')
  if (a === 'AUTH_LOGIN_FAILED') return t('history.authLoginFailed')
  if (a === 'PAGE_VIEW') return t('history.pageView')

  const parsed = parseHistoryAction(a)
  if (parsed.kind === 'code') return parsed.code || t('common.none')

  const { method, path } = parsed
  if (method === 'DELETE') return t('history.actionDeleteRecord')
  if (method === 'POST') return t('history.actionCreateRecord')
  if (method === 'PUT' || method === 'PATCH') return t('history.actionUpdateRecord')
  if (method === 'GET' || method === 'HEAD') {
    return historyPathLooksLikeDetail(path) ? t('history.pageView') : t('history.actionListView')
  }
  if (method === 'VIEW') return t('history.pageView')

  return t('history.actionOther')
}

/** Текст для tooltip: полный запрос или путь SPA. */
export function technicalHistoryDetail(row) {
  if (!row) return ''
  if (row.action === 'PAGE_VIEW') {
    const p = row.details?.page_path || row.object_id
    return p ? `VIEW ${p}` : 'PAGE_VIEW'
  }
  const parsed = parseHistoryAction(row.action)
  if (parsed.kind === 'api') return String(row.action).trim()
  return row.action || ''
}

/** Подсказка с техническими деталями; для чисто текстовых событий авторизации не показываем. */
export function historyActionTooltip(row) {
  if (!row?.action) return undefined
  if (row.action === 'AUTH_LOGIN' || row.action === 'AUTH_LOGOUT' || row.action === 'AUTH_LOGIN_FAILED') {
    return undefined
  }
  const tech = technicalHistoryDetail(row)
  return tech || undefined
}
