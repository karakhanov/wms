/**
 * Hook для загрузки исторических данных KPI для трендов и спарклайна
 */
import { useEffect, useState } from 'react'
import { reports } from '../api'

export function useKPIHistory() {
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        // Получаем историю за последнюю неделю для спарклайна
        const data = await reports.summary()
        if (!alive) return

        // Симулируем исторические данные (в реальности должны приходить с API)
        const sparklineMap = {
          receipts_period: [5, 6, 5, 7, 8, 6, 7],
          orders_period: [12, 14, 13, 15, 18, 16, 20],
          active_orders: [3, 4, 5, 3, 6, 4, 5],
          transfers_period: [2, 3, 1, 4, 2, 3, 1],
          inventories_open: [1, 2, 1, 0, 1, 2, 1],
          below_min: [5, 8, 10, 12, 8, 6, 4],
        }

        setHistory(sparklineMap)
      } catch {
        if (alive) setHistory({})
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  return { history, loading }
}

/**
 * Калькулятор процента изменения между двумя значениями
 */
export function calculateTrend(current, previous) {
  if (!previous || previous === 0) return null
  const change = ((current - previous) / previous) * 100
  return {
    value: Math.round(change),
    isPositive: change >= 0,
  }
}
