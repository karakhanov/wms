export function inDateRange(value, preset, fromDate, toDate) {
  // If no date filter is selected, do not exclude rows.
  if (!preset) return true
  if (preset === 'custom' && !fromDate && !toDate) return true

  const ts = Date.parse(value || '')
  if (!Number.isFinite(ts)) return false
  const now = new Date()
  const target = new Date(ts)

  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return target >= start && target < end
  }
  if (preset === 'week') {
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return target >= start && target < end
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return target >= start && target < end
  }
  if (preset === 'custom') {
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : Number.NEGATIVE_INFINITY
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59.999`) : Number.POSITIVE_INFINITY
    return ts >= fromTs && ts <= toTs
  }
  return true
}
