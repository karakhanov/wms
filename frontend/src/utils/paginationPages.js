/**
 * @param {number} current 1-based
 * @param {number} total
 * @returns {(number | 'ellipsis')[]}
 */
export function getPaginationPageNumbers(current, total) {
  if (total <= 1) return []
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const delta = 2
  const range = new Set()
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.add(i)
    }
  }
  const sorted = Array.from(range).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}
