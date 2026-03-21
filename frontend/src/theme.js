import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'wms-theme'

/** @returns {'dark' | 'light'} */
export function getStoredTheme() {
  const v = storageGet(STORAGE_KEY)
  return v === 'light' ? 'light' : 'dark'
}

/** @param {'dark' | 'light'} theme */
export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  storageSet(STORAGE_KEY, t)
}

export function initTheme() {
  applyTheme(getStoredTheme())
}

/** @returns {'dark' | 'light'} */
export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
  applyTheme(next)
  return next
}
