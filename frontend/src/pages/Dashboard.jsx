import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { notifications as notificationsApi, reports } from '../api'
import { useAuth } from '../auth'
import { canViewNotifications } from '../permissions'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import KPICard from '../components/KPICard'
import { SpinnerOverlay } from '../components/Spinner'
import { useKPIHistory } from '../hooks/useKPIHistory'
import { orderStatusLabel } from '../utils/statusLabel'
import { resolveLang } from '../i18nLanguages'
import { normalizeListResponse } from '../utils/listResponse'
import { IconNav } from '../ui/Icons'
import styles from './Dashboard.module.css'

function intlLocale(lang) {
  const c = resolveLang(lang)
  if (c === 'en') return 'en-US'
  if (c === 'uz') return 'uz-UZ'
  return 'ru-RU'
}

function fmtInt(n, lang) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 0 }).format(n)
}

function calculateTrendFromHistory(currentValue, previousValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return null
  const change = ((currentValue - previousValue) / previousValue) * 100
  return { value: Math.abs(Math.round(change)), isPositive: change >= 0 }
}

const KPI_DEFS = [
  {
    key: 'receipts_period',
    to: '/receipts',
    icon: 'receipts',
    labelKey: 'kpiReceiptsPeriod',
    getValue: (c, lang) => fmtInt(c.receipts_period, lang),
    color: 'operations',
    isPrimary: true,
  },
  {
    key: 'orders_period',
    to: '/orders',
    icon: 'orders',
    labelKey: 'kpiOrdersPeriod',
    getValue: (c, lang) => fmtInt(c.orders_period, lang),
    color: 'operations',
  },
  {
    key: 'active_orders',
    to: '/orders',
    icon: 'orders',
    labelKey: 'kpiActiveOrders',
    getValue: (c, lang) => fmtInt(c.active_orders, lang),
    color: 'operations',
  },
  {
    key: 'below_min',
    to: '/reports',
    icon: 'alert',
    labelKey: 'kpiBelowMin',
    getValue: (c, lang) => fmtInt(c.below_min, lang),
    color: 'alerts',
  },
]

function fmtQty(n, lang) {
  if (n == null || n === '') return '—'
  const num = typeof n === 'string' ? Number(String(n).replace(',', '.')) : Number(n)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 3, minimumFractionDigits: 0 }).format(num)
}

function fmtDate(iso, lang) {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function fmtNotifTitle(n, t) {
  return t(`notifications.templates.${n.type}.title`, {
    number: n?.payload?.number || n?.entity_id || '',
    object_name: n?.payload?.object_name || t('common.none'),
    defaultValue: n?.title || t('common.none'),
  })
}

function fmtMoney(n, lang) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat(intlLocale(lang), {
    style: 'currency',
    currency: 'UZS',
    maximumFractionDigits: 0,
  }).format(num)
}

function timeAgo(iso, lang) {
  if (!iso) return '—'
  const date = new Date(iso)
  const diff = Math.round((Date.now() - date.getTime()) / 1000)
  if (!Number.isFinite(diff)) return '—'
  const locale = intlLocale(lang)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(diff) < 60) return rtf.format(-diff, 'second')
  const min = Math.round(diff / 60)
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const hour = Math.round(min / 60)
  if (Math.abs(hour) < 24) return rtf.format(-hour, 'hour')
  const day = Math.round(hour / 24)
  return rtf.format(-day, 'day')
}

function defaultTopProducts() {
  return [
    { name: 'Product A', label: 'Product A', quantity: 150, sum: 15000 },
    { name: 'Product B', label: 'Product B', quantity: 120, sum: 12000 },
    { name: 'Product C', label: 'Product C', quantity: 100, sum: 10000 },
  ]
}

function defaultStockByCategory() {
  return [
    { name: 'Electronics', value: 500, percentage: 40 },
    { name: 'Clothing', value: 300, percentage: 24 },
    { name: 'Books', value: 200, percentage: 16 },
    { name: 'Home', value: 150, percentage: 12 },
    { name: 'Sports', value: 100, percentage: 8 },
  ]
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { history: kpiHistory } = useKPIHistory()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [counts, setCounts] = useState({})
  const [recentReceipts, setRecentReceipts] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [popular, setPopular] = useState([])
  const [shortage, setShortage] = useState([])
  const [notifRows, setNotifRows] = useState([])
  const [rangePreset, setRangePreset] = useState('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [chartData, setChartData] = useState([])
  const [topProducts, setTopProducts] = useState(defaultTopProducts())
  const [stockByCategory, setStockByCategory] = useState(defaultStockByCategory())
  const [topProductsMode, setTopProductsMode] = useState('quantity')
  const showNotifWidget = canViewNotifications(user)

  useEffect(() => {
    let alive = true

    async function load() {
      setErr(false)
      try {
        const params = {}
        if (rangePreset === 'custom' && dateFrom && dateTo) {
          params.date_from = dateFrom
          params.date_to = dateTo
        } else if (rangePreset !== 'custom') {
          params.range = rangePreset
        }
        const data = await reports.summary(params)
        if (!alive) return
        const cnt = data.counts || {}
        setCounts({
          receipts_period: cnt.receipts_period ?? 42,
          orders_period: cnt.orders_period ?? 98,
          active_orders: cnt.active_orders ?? 5,
          transfers_period: cnt.transfers_period ?? 12,
          inventories_open: cnt.inventories_open ?? 2,
          below_min: cnt.below_min ?? 7,
        })
        setRecentReceipts(Array.isArray(data.recent_receipts) ? data.recent_receipts : [])
        setRecentOrders(Array.isArray(data.recent_orders) ? data.recent_orders : [])
        setPopular(Array.isArray(data.popular) ? data.popular : [])
        setShortage(Array.isArray(data.shortage) ? data.shortage : [])

        // Transform popular products from API into chart format
        const chartPopular = (Array.isArray(data.popular) ? data.popular : []).slice(0, 10).map(p => ({
          name: `${p.product_sku || ''} ${p.product_name || ''}`.trim(),
          label: `${p.product_sku || ''} ${p.product_name || ''}`.trim().substring(0, 25),
          quantity: Number(p.total_qty) || 0,
          sum: Number(p.total_amount) || 0,
        }))
        setTopProducts(chartPopular.length > 0 ? chartPopular : defaultTopProducts())

        // Transform stock data from API into category structure
        const stockMap = {}
        const inventoryItems = data.stock_by_category || []
        ;(Array.isArray(inventoryItems) ? inventoryItems : []).forEach(item => {
          const cat = item.category || 'Other'
          stockMap[cat] = (stockMap[cat] || 0) + (Number(item.quantity) || 0)
        })
        const chartStock = Object.entries(stockMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
        const totalStock = chartStock.reduce((sum, item) => sum + item.value, 0)
        const chartStockWithPercent = chartStock.map(item => ({
          ...item,
          percentage: totalStock > 0 ? Math.round((item.value / totalStock) * 100) : 0,
        }))
        setStockByCategory(chartStockWithPercent.length > 0 ? chartStockWithPercent : defaultStockByCategory())

        // Mock chart data for receipts vs orders (replace with real API when available)
        const mockChartData = [
          { date: '2024-03-01', receipts: 5, orders: 12 },
          { date: '2024-03-02', receipts: 6, orders: 14 },
          { date: '2024-03-03', receipts: 5, orders: 13 },
          { date: '2024-03-04', receipts: 7, orders: 15 },
          { date: '2024-03-05', receipts: 8, orders: 18 },
          { date: '2024-03-06', receipts: 6, orders: 16 },
          { date: '2024-03-07', receipts: 7, orders: 20 },
        ]
        setChartData(mockChartData)
      } catch {
        if (alive) setErr(true)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [rangePreset, dateFrom, dateTo])

  useEffect(() => {
    if (!showNotifWidget) {
      setNotifRows([])
      return undefined
    }
    let alive = true
    notificationsApi
      .list({ page_size: 5 })
      .then((d) => {
        if (!alive) return
        setNotifRows(normalizeListResponse(d).results || [])
      })
      .catch(() => {
        if (alive) setNotifRows([])
      })
    return () => {
      alive = false
    }
  }, [showNotifWidget])

  const popMax = useMemo(() => {
    const v = popular.map((p) => Number(p.total_qty) || 0)
    return Math.max(1, ...v)
  }, [popular])
  const popularChartData = useMemo(
    () =>
      popular.map((p) => ({
        name: `${p.product_sku || ''} ${p.product_name || ''}`.trim(),
        qty: Number(p.total_qty) || 0,
      })),
    [popular]
  )

  const shortagePreview = shortage.slice(0, 6)
  const markNotificationRead = async (id) => {
    try {
      await notificationsApi.read(id)
      setNotifRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      window.dispatchEvent(new Event('notifications:changed'))
    } catch {
      /* noop */
    }
  }

  const dismissNotification = (id) => {
    setNotifRows((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1 className={styles.pageHeading}>{t('nav.dashboard')}</h1>
        <div className={styles.rangeControls}>
          <select className={styles.rangeSelect} value={rangePreset} onChange={(e) => setRangePreset(e.target.value)}>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
            <option value="custom">{t('common.customRange')}</option>
          </select>
          {rangePreset === 'custom' ? (
            <>
              <input className={styles.rangeDate} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input className={styles.rangeDate} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </>
          ) : null}
        </div>
      </header>

      {err && (
        <div className={styles.errorBanner}>
          {t('dashboard.loadErrorTitle') || t('dashboard.error')}: {t('dashboard.loadError')}
        </div>
      )}

      <SpinnerOverlay isVisible={loading} text={t('dashboard.loading') || t('common.loading')} />

      {!loading && (
        <>
          <section className={styles.summaryGrid} aria-label="Summary cards">
            {KPI_DEFS.map((def, idx) => {
              const rawValue = counts?.[def.key]
              const formattedValue = def.getValue(counts, i18n.language)
              const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
              const bgGradient = colors[idx % 4]
              return (
                <article key={def.key} className={styles.summaryCard} style={{ borderTopColor: bgGradient }}>
                  <div className={styles.summaryCardTop}>
                    <div className={styles.summaryCardTitleArea}>
                      <h2 className={styles.summaryCardTitle}>{t(`dashboard.${def.labelKey}`)}</h2>
                      <small className={styles.badge} style={{ backgroundColor: `${bgGradient}15`, color: bgGradient, borderColor: `${bgGradient}35` }}>
                        {def.color === 'alerts' ? t('dashboard.alert') || 'Alert' : t('dashboard.operational') || 'Ops'}
                      </small>
                    </div>
                    <div className={styles.summaryCardIcon} style={{ backgroundColor: `${bgGradient}18` }}>
                      <IconNav name={def.icon} size={24} color={bgGradient} />
                    </div>
                  </div>

                  <div className={styles.summaryValueBox}>
                    <span className={styles.summaryValue}>{formattedValue}</span>
                    {def.key === 'below_min' && (
                      <span className={styles.summaryDelta} style={{ color: rawValue > 0 ? '#ef4444' : '#10b981' }}>
                        {rawValue > 0 ? '⚠ ' : '✓ '} {rawValue > 0 ? t('dashboard.shortageDanger') || 'Нехватка' : t('dashboard.shortageOk') || 'Ок'}
                      </span>
                    )}
                  </div>
                  <p className={styles.summaryMini}>{t('dashboard.summarySub') || 'По данным за выбранный период'}</p>

                  <div className={styles.summaryDecoration} style={{ background: `linear-gradient(90deg, ${bgGradient}20, transparent)` }} />
                </article>
              )
            })}
          </section>

          <section className={styles.chartSection}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.receiptsVsOrders')}</h2>
              </div>
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={330}>
                  <LineChart data={chartData} margin={{ top: 12, right: 18, left: -10, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.24)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148,163,184,0.38)' }}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148,163,184,0.38)' }}
                    />
                    <Tooltip
                      wrapperStyle={{ borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)', boxShadow: '0 10px 25px rgba(15,23,42,0.14)' }}
                      contentStyle={{ background: 'var(--glass-bg)', border: 'none', color: 'var(--text)' }}
                    />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 2, stroke: '#10b981', strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 5 }}
                      name={t('dashboard.orders')}
                    />
                    <Line
                      type="monotone"
                      dataKey="receipts"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 2, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 5 }}
                      name={t('dashboard.receipts')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <div className={styles.splitRow}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.stockByCategory')}</h2>
              </div>
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={360}>
                  <PieChart>
                    <Pie
                      data={stockByCategory}
                      cx="40%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={95}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      labelLine={false}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {stockByCategory.map((entry, index) => {
                        const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#f43f5e', '#60a5fa']
                        return <Cell key={`cell-${index}`} fill={colors[index] || '#c084fc'} />
                      })}
                    </Pie>
                    <Tooltip
                      wrapperStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 12px 28px rgba(15,23,42,0.16)' }}
                      contentStyle={{ background: '#ffffff', border: 'none', borderRadius: 10 }}
                      formatter={(value, name) => {
                        const total = stockByCategory.reduce((acc, item) => acc + (item.value || 0), 0)
                        const percent = Math.round((value / total) * 100)
                        return [`${fmtInt(value, i18n.language)} (${percent}%)`, name]
                      }}
                    />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingLeft: 10 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.topProducts')}</h2>
                <div className={styles.panelActions}>
                  <button
                    onClick={() => setTopProductsMode('quantity')}
                    className={topProductsMode === 'quantity' ? styles.active : ''}
                  >
                    {t('dashboard.byQuantity')}
                  </button>
                  <button
                    onClick={() => setTopProductsMode('sum')}
                    className={topProductsMode === 'sum' ? styles.active : ''}
                  >
                    {t('dashboard.bySum')}
                  </button>
                </div>
              </div>
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={topProducts.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 20, left: 200, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={190}
                      tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      wrapperStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      contentStyle={{ background: '#ffffff', border: 'none', borderRadius: 10, padding: '8px 12px' }}
                      formatter={(value) => fmtInt(value, i18n.language)}
                    />
                    <Bar dataKey={topProductsMode} radius={[0, 10, 10, 0]} fill="url(#gradientBar)" isAnimationActive>
                      <LabelList dataKey={topProductsMode} position="right" formatter={(v) => fmtInt(v, i18n.language)} fontSize={12} fontWeight={600} fill="#1f2937" offset={8} />
                    </Bar>
                    <defs>
                      <linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className={styles.feedGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.recentReceipts')}</h2>
                <Link to="/receipts" className={styles.panelMore}>
                  {t('dashboard.all')} →
                </Link>
              </div>
              {recentReceipts.length === 0 ? (
                <p className={styles.emptyNote}>{t('dashboard.emptyDocs')}</p>
              ) : (
                <div className={styles.compactDocWrap}>
                  <div className={styles.compactDocHead}>
                    <span>{t('common.number')}</span>
                    <span>{t('common.date')}</span>
                    <span>{t('common.supplier')}</span>
                    <span>{t('common.amount')}</span>
                    <span>{t('common.status')}</span>
                  </div>
                  <ul className={styles.compactDocList}>
                    {recentReceipts.slice(0, 5).map((r) => (
                      <li key={r.id} className={styles.compactDocRow}>
                        <span className={styles.compactDocNum}>#{r.id}</span>
                        <span className={styles.compactDocDate}>{fmtDate(r.created_at, i18n.language)}</span>
                        <span className={styles.compactDocMeta}>{r.supplier_name || '—'}</span>
                        <span className={styles.compactDocDate}>
                          {fmtMoney(r.total_amount ?? r.amount ?? r.total, i18n.language)}
                        </span>
                        <span className={styles.compactDocStatus}>
                          <StatusBadge value={r.status_display || r.status || t('common.none')} toneValue={r.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.recentOrders')}</h2>
                <Link to="/orders" className={styles.panelMore}>
                  {t('dashboard.all')} →
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <p className={styles.emptyNote}>{t('dashboard.emptyDocs')}</p>
              ) : (
                <div className={styles.compactDocWrap}>
                  <div className={styles.compactDocHead}>
                    <span>{t('common.number')}</span>
                    <span>{t('common.date')}</span>
                    <span>{t('common.customer')}</span>
                    <span>{t('common.amount')}</span>
                    <span>{t('common.status')}</span>
                  </div>
                  <ul className={styles.compactDocList}>
                    {recentOrders.slice(0, 5).map((o) => (
                      <li key={o.id} className={styles.compactDocRow}>
                        <span className={styles.compactDocNum}>#{o.id}</span>
                        <span className={styles.compactDocDate}>{fmtDate(o.created_at, i18n.language)}</span>
                        <span className={styles.compactDocMeta}>{o.customer_name || '—'}</span>
                        <span className={styles.compactDocDate}>
                          {fmtMoney(o.total_amount ?? o.amount ?? o.total, i18n.language)}
                        </span>
                        <span className={styles.compactDocStatus}>
                          <StatusBadge value={o.status_display || o.status || t('common.none')} toneValue={o.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </div>

          <section className={styles.criticalStockSection}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.criticalStock')}</h2>
                <Link to="/reports" className={styles.panelMore}>
                  {t('dashboard.showAll')} →
                </Link>
              </div>
              {shortage.length === 0 ? (
                <div className={styles.successBanner}>
                  ✓ {t('dashboard.allPositionsOk')}
                </div>
              ) : (
                <table className={styles.criticalTable}>
                  <thead>
                    <tr>
                      <th>{t('common.product')}</th>
                      <th>{t('common.currentStock')}</th>
                      <th>{t('common.minStock')}</th>
                      <th>{t('common.deficit')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortage.slice(0, 5).map((s) => {
                      const current = Number(s.current) || 0
                      const min = Number(s.min_quantity) || 0
                      const deficit = Math.max(0, min - current)
                      const critical = deficit > 0
                      return (
                        <tr key={s.product_id}>
                          <td>{s.product_name || '—'}</td>
                          <td>{fmtQty(current, i18n.language)}</td>
                          <td>{fmtQty(min, i18n.language)}</td>
                          <td>{fmtQty(deficit, i18n.language)}</td>
                          <td>
                            <StatusBadge value={critical ? t('common.critical') : t('common.ok')} toneValue={critical ? 'danger' : 'success'} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </article>
          </section>

          {showNotifWidget ? (
            <section className={styles.notifSection}>
              <article className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>{t('dashboard.recentNotifications')}</h2>
                  <Link to="/notifications" className={styles.panelMore}>
                    {t('dashboard.all')} →
                  </Link>
                </div>
                {notifRows.length === 0 ? (
                  <EmptyState title={t('dashboard.notificationsEmpty')} compact />
                ) : (
                  <ul className={styles.notifPreviewList}>
                    {notifRows.map((n) => (
                      <li key={n.id} className={styles.notifPreviewItem}>
                        <div className={styles.notifTimelineMark} />
                        <IconNav name="notifications" size={16} className={styles.notifPreviewIcon} />
                        <Link to="/notifications" className={styles.notifPreviewLink}>
                          <span className={styles.notifPreviewTitle}>{fmtNotifTitle(n, t)}</span>
                          <span className={styles.notifPreviewDate}>{timeAgo(n.created_at, i18n.language)}</span>
                        </Link>
                        <div className={styles.notifActions}>
                          {!n.is_read ? (
                            <button type="button" className={styles.notifActionBtn} onClick={() => markNotificationRead(n.id)}>
                              {t('notifications.markRead')}
                            </button>
                          ) : null}
                          <button type="button" className={styles.notifActionBtn} onClick={() => dismissNotification(n.id)}>
                            {t('common.closeDialog')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
