import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { reports } from '../api'
import StatusBadge from '../components/StatusBadge'
import { orderStatusLabel } from '../utils/statusLabel'
import { resolveLang } from '../i18nLanguages'
import { IconNav } from '../ui/Icons'
import styles from './Dashboard.module.css'

const blocks = [
  { to: '/products', titleKey: 'products', icon: 'products' },
  { to: '/categories', titleKey: 'categories', icon: 'categories' },
  { to: '/warehouse', titleKey: 'warehouse', icon: 'warehouse' },
  { to: '/suppliers', titleKey: 'suppliers', icon: 'suppliers' },
  { to: '/receipts', titleKey: 'receipts', icon: 'receipts' },
  { to: '/orders', titleKey: 'orders', icon: 'orders' },
  { to: '/stock', titleKey: 'stock', icon: 'stock' },
  { to: '/transfers', titleKey: 'transfers', icon: 'transfers' },
  { to: '/inventory', titleKey: 'inventory', icon: 'inventory' },
  { to: '/reports', titleKey: 'reports', icon: 'reports' },
  { to: '/users', titleKey: 'users', icon: 'users' },
]

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

function fmtQty(n, lang) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(n)
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

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [counts, setCounts] = useState({})
  const [recentReceipts, setRecentReceipts] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [popular, setPopular] = useState([])
  const [shortage, setShortage] = useState([])

  useEffect(() => {
    let alive = true

    async function load() {
      setErr(false)
      try {
        const data = await reports.summary()
        if (!alive) return
        const cnt = data.counts || {}
        setCounts({
          products: cnt.products ?? null,
          categories: cnt.categories ?? null,
          suppliers: cnt.suppliers ?? null,
          receipts: cnt.receipts ?? null,
          orders: cnt.orders ?? null,
          balances: cnt.balances ?? null,
          warehouses: cnt.warehouses ?? null,
          cells: cnt.cells ?? null,
          transfers: cnt.transfers ?? null,
          inventories_open: cnt.inventories_open ?? null,
          inventories: cnt.inventories ?? null,
        })
        setRecentReceipts(Array.isArray(data.recent_receipts) ? data.recent_receipts : [])
        setRecentOrders(Array.isArray(data.recent_orders) ? data.recent_orders : [])
        setPopular(Array.isArray(data.popular) ? data.popular : [])
        setShortage(Array.isArray(data.shortage) ? data.shortage : [])
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
  }, [])

  const popMax = useMemo(() => {
    const v = popular.map((p) => Number(p.total_qty) || 0)
    return Math.max(1, ...v)
  }, [popular])

  const shortagePreview = shortage.slice(0, 6)

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1 className={styles.pageHeading}>{t('nav.dashboard')}</h1>
      </header>

      {err && <p className={styles.errorBanner}>{t('dashboard.loadError')}</p>}

      {loading && (
        <div className={styles.skeletonGrid} aria-hidden>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className={styles.skeletonKpi} />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <section className={styles.kpiRow} aria-label="KPI">
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.products, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiProducts')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.categories, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiCategories')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.suppliers, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiSuppliers')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.receipts, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiReceipts')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.orders, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiOrders')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.balances, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiBalances')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>
                {fmtInt(counts.warehouses, i18n.language)} / {fmtInt(counts.cells, i18n.language)}
              </span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiWarehouses')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>{fmtInt(counts.transfers, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiTransfers')}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiValue}>
                {fmtInt(counts.inventories_open, i18n.language)} / {fmtInt(counts.inventories, i18n.language)}
              </span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiInventory')}</span>
            </div>
            <div className={`${styles.kpi} ${shortage.length > 0 ? styles.kpiWarn : ''}`}>
              <span className={styles.kpiValue}>{fmtInt(shortage.length, i18n.language)}</span>
              <span className={styles.kpiLabel}>{t('dashboard.kpiShortage')}</span>
            </div>
          </section>

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
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.feedTable}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.colDoc')}</th>
                          <th>{t('dashboard.colDate')}</th>
                          <th>{t('dashboard.colSupplier')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentReceipts.map((r) => (
                          <tr key={r.id}>
                            <td className={styles.mono}>#{r.id}</td>
                            <td>{fmtDate(r.created_at, i18n.language)}</td>
                            <td>{r.supplier_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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
                <div className={styles.tableWrap}>
                  <table className={styles.feedTable}>
                    <thead>
                      <tr>
                        <th>{t('dashboard.colDoc')}</th>
                        <th>{t('dashboard.colDate')}</th>
                        <th>{t('dashboard.colStatus')}</th>
                        <th>{t('dashboard.colClient')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className={styles.mono}>#{o.id}</td>
                          <td>{fmtDate(o.created_at, i18n.language)}</td>
                          <td>
                            <StatusBadge value={orderStatusLabel(t, o.status, o.status_display || o.status || '')} toneValue={o.status} />
                          </td>
                          <td>{o.client_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>

          <div className={styles.splitRow}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.popularTitle')}</h2>
              </div>
              {popular.length === 0 ? (
                <p className={styles.emptyNote}>—</p>
              ) : (
                <ul className={styles.hBarList}>
                  {popular.map((p) => (
                    <li key={p.product} className={styles.hBarRow}>
                      <span className={styles.hBarName} title={`${p.product_sku} — ${p.product_name}`}>
                        {p.product_sku || '—'} · {p.product_name || '—'}
                      </span>
                      <div className={styles.hBarTrack}>
                        <div
                          className={styles.hBarFill}
                          style={{ width: `${((Number(p.total_qty) || 0) / popMax) * 100}%` }}
                        />
                      </div>
                      <span className={styles.hBarVal}>{fmtQty(p.total_qty, i18n.language)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('dashboard.shortageTitle')}</h2>
              </div>
              {shortagePreview.length === 0 ? (
                <p className={styles.emptyOk}>{t('dashboard.shortageEmpty')}</p>
              ) : (
                <ul className={styles.shortList}>
                  {shortagePreview.map((s) => (
                    <li key={s.product_id} className={styles.shortItem}>
                      <span className={styles.shortSku}>{s.product_sku}</span>
                      <span className={styles.shortName}>{s.product_name}</span>
                      <span className={styles.shortNums}>
                        {fmtQty(s.current, i18n.language)} / {fmtQty(s.min_quantity, i18n.language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/reports" className={styles.panelLink}>
                {t('dashboard.openReports')} →
              </Link>
            </article>
          </div>
        </>
      )}

      <section className={styles.modulesSection}>
        <h2 className={styles.modulesTitle}>{t('dashboard.modulesTitle')}</h2>
        <div className={styles.grid}>
          {blocks.map(({ to, titleKey, icon }) => (
            <Link key={to} to={to} className={styles.card}>
              <span className={styles.cardIcon}>
                <IconNav name={icon} size={22} />
              </span>
              <h3 className={styles.cardTitle}>{t(`nav.${titleKey}`)}</h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
