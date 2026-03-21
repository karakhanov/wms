/** Диапазон дат для API журнала (сервер фильтрует; совместимо с пресетами UI). */
export function actionLogDateParams(preset, from, to) {
  if (preset === 'custom') {
    return {
      date_from: from || undefined,
      date_to: to || undefined,
    }
  }
  if (!preset) return {}
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (preset === 'today') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { date_from: iso(d), date_to: iso(d) }
  }
  if (preset === 'week') {
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { date_from: iso(start), date_to: iso(end) }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { date_from: iso(start), date_to: iso(end) }
  }
  return {}
}
