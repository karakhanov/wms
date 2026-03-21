export const LANGUAGES = ['ru', 'uz', 'en']

/** Нормализует код языка для <select> (ru, uz, en) */
export function resolveLang(code) {
  const c = (code || '').split('-')[0].toLowerCase()
  return LANGUAGES.includes(c) ? c : 'ru'
}
