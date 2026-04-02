function groupThousands(intPart) {
  if (!intPart) return ''
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function sanitizeNumberInput(raw, maxDecimals = 3) {
  const text = String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  if (!text) return ''

  const firstDot = text.indexOf('.')
  const normalized = firstDot === -1
    ? text
    : `${text.slice(0, firstDot + 1)}${text.slice(firstDot + 1).replace(/\./g, '')}`

  const [intPart = '', fracPart = ''] = normalized.split('.')
  const safeInt = intPart.replace(/^0+(?=\d)/, '')
  if (firstDot === -1) return safeInt
  return `${safeInt}.${fracPart.slice(0, maxDecimals)}`
}

export function formatNumberInput(raw) {
  const value = String(raw ?? '')
  if (!value) return ''
  const hasDot = value.includes('.')
  const [intPart = '', fracPart = ''] = value.split('.')
  const grouped = groupThousands(intPart)
  if (!hasDot) return grouped
  return `${grouped},${fracPart}`
}

export function formatNumberCell(value, maxDecimals = 3) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(String(value).replace(/\s+/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: maxDecimals,
  }).format(n)
}

export function numberInputToApi(value) {
  return value === '' || value === null || value === undefined ? null : String(value)
}
