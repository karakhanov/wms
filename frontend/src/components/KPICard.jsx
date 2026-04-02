import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { IconNav } from '../ui/Icons'
import styles from './KPICard.module.css'

/**
 * KPI Card — современная карточка метрики с трендом, спарклайном и цветным акцентом
 */
export default function KPICard({
  to,
  icon,
  label,
  value,
  trend = null, // { value: number, isPositive: boolean } или null
  sparklineData = [], // массив чисел [1, 2, 3, ..., 10]
  colorVariant = 'teal', // 'teal' | 'blue' | 'amber' | 'rose' | 'indigo'
  isPrimary = false, // true только для "Товары"
  warning = false,
  countUpValue = null,
  valueFormatter = (n) => String(n),
}) {
  const colorMap = {
    inventory: '#2563EB',
    operations: '#0EA5E9',
    infrastructure: '#7C3AED',
    alerts: '#F59E0B',
  }

  const accentColor = colorMap[colorVariant] || colorMap.inventory
  const [animatedValue, setAnimatedValue] = useState(value)

  useEffect(() => {
    if (!Number.isFinite(countUpValue) || countUpValue < 0) {
      setAnimatedValue(value)
      return
    }

    const duration = 700
    const startedAt = performance.now()
    let rafId = 0

    const tick = (ts) => {
      const progress = Math.min((ts - startedAt) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(countUpValue * eased)
      setAnimatedValue(valueFormatter(next))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [countUpValue, value, valueFormatter])

  return (
    <Link to={to} className={`${styles.card} ${isPrimary ? styles.primary : ''} ${warning ? styles.warning : ''}`}>
      {/* Левый цветной бордер */}
      <div className={styles.colorBar} style={{ backgroundColor: accentColor }} />

      {/* Иконка */}
      <div className={styles.iconWrapper} style={{ backgroundColor: `${accentColor}15` }}>
        <IconNav name={icon} size={20} color={accentColor} />
      </div>

      {/* Основной контент */}
      <div className={styles.content}>
        <div className={styles.headerRow}>
          <div className={styles.labelWrapper}>
            <span className={styles.label}>{label}</span>
          </div>
        </div>

        <div className={styles.valueRow}>
          <span className={styles.value}>{Number.isFinite(countUpValue) ? animatedValue : value}</span>
          {trend && (
            <div className={`${styles.trend} ${trend.isPositive ? styles.trendUp : styles.trendDown}`}>
              <span className={styles.trendArrow}>{trend.isPositive ? '↑' : '↓'}</span>
              <span className={styles.trendValue}>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Sparkline график справа (если есть данные) */}
      {sparklineData && sparklineData.length > 0 && (
        <div className={styles.sparklineWrapper}>
          <Sparkline data={sparklineData} color={accentColor} />
        </div>
      )}
    </Link>
  )
}

/**
 * Простой sparkline график в SVG
 */
function Sparkline({ data, color = '#1B6B4A' }) {
  if (!data || data.length < 2) return null
  const chartData = data.map((v, i) => ({ idx: i, value: Number(v) || 0 }))

  return (
    <ResponsiveContainer width={60} height={30}>
      <LineChart data={chartData} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive />
      </LineChart>
    </ResponsiveContainer>
  )
}
