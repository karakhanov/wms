/**
 * Отображение количества: без лишних .000, дробная часть только если не нулевая (до 3 знаков).
 */
export function formatQuantity(value) {
  if (value === '' || value === null || value === undefined) return '0'
  const n = typeof value === 'string' ? Number(String(value).replace(',', '.')) : Number(value)
  if (!Number.isFinite(n)) return '0'
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s || '0'
}
