/** Безопасный доступ к localStorage (инкогнито, блокировка — иначе белый экран) */

export function storageGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function storageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
