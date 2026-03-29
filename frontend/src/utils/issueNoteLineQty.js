/**
 * Количество по строке накладной для остатков / нехватки / списания:
 * после приёмки — факт, иначе заявленное.
 */
export function effectiveIssueLineQty(it) {
  if (!it) return 0
  const a = it.actual_quantity
  if (a != null && a !== '') {
    const n = Number(String(a).replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return Number(it.quantity || 0)
}
