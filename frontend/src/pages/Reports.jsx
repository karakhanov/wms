import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { downloadCsv } from '../utils/csvExport'
import { totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { formatQuantity } from '../utils/formatQuantity'
import styles from './Table.module.css'

function matchSearch(row, q, fields) {
  if (!q || !q.trim()) return true
  const s = q.trim().toLowerCase()
  return fields.some((f) => String(f(row)).toLowerCase().includes(s))
}

export default function Reports() {
  const { t } = useTranslation()
  const [shortage, setShortage] = useState([])
  const [popular, setPopular] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchShort, setSearchShort] = useState('')
  const [searchPop, setSearchPop] = useState('')
  const [shortSort, setShortSort] = useState({ key: 'product', dir: 'asc' })
  const [popSort, setPopSort] = useState({ key: 'product', dir: 'asc' })
  const [shortPage, setShortPage] = useState(1)
  const [shortPageSize, setShortPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [popPage, setPopPage] = useState(1)
  const [popPageSize, setPopPageSize] = useState(DEFAULT_PAGE_SIZE)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/reports/shortage/').then((r) => r.data || []),
      api.get('/reports/popular/').then((r) => r.data || []),
    ])
      .then(([sh, pop]) => {
        setShortage(Array.isArray(sh) ? sh : [])
        setPopular(Array.isArray(pop) ? pop : [])
      })
      .catch(() => {
        setShortage([])
        setPopular([])
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredShortage = useMemo(() => {
    return shortage.filter((row) =>
      matchSearch(row, searchShort, [
        (r) => r.product_sku,
        (r) => r.product_name,
      ])
    )
  }, [shortage, searchShort])

  const filteredPopular = useMemo(() => {
    return popular.filter((row) =>
      matchSearch(row, searchPop, [
        (r) => r.product_sku,
        (r) => r.product_name,
      ])
    )
  }, [popular, searchPop])

  const sortedShortage = useMemo(() => {
    const list = [...filteredShortage]
    const factor = shortSort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = shortSort.key === 'min' ? Number(a.min_quantity || 0) : shortSort.key === 'current' ? Number(a.current || 0) : `${a.product_sku || ''} ${a.product_name || ''}`
      const bv = shortSort.key === 'min' ? Number(b.min_quantity || 0) : shortSort.key === 'current' ? Number(b.current || 0) : `${b.product_sku || ''} ${b.product_name || ''}`
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [filteredShortage, shortSort])

  const sortedPopular = useMemo(() => {
    const list = [...filteredPopular]
    const factor = popSort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = popSort.key === 'qty' ? Number(a.total_qty || 0) : `${a.product_sku || ''} ${a.product_name || ''}`
      const bv = popSort.key === 'qty' ? Number(b.total_qty || 0) : `${b.product_sku || ''} ${b.product_name || ''}`
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [filteredPopular, popSort])

  const pagedShortage = useMemo(() => {
    const start = (shortPage - 1) * shortPageSize
    return sortedShortage.slice(start, start + shortPageSize)
  }, [sortedShortage, shortPage, shortPageSize])

  const pagedPopular = useMemo(() => {
    const start = (popPage - 1) * popPageSize
    return sortedPopular.slice(start, start + popPageSize)
  }, [sortedPopular, popPage, popPageSize])

  const shortPages = totalPages(sortedShortage.length, shortPageSize)
  const popPages = totalPages(sortedPopular.length, popPageSize)

  const toggleShortSort = (key) => {
    setShortPage(1)
    setShortSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }
  const togglePopSort = (key) => {
    setPopPage(1)
    setPopSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const exportShortage = () => {
    downloadCsv(
      `shortage_${new Date().toISOString().slice(0, 10)}`,
      [t('stock.product'), t('reports.minQty'), t('reports.current')],
      filteredShortage.map((s) => [
        `${s.product_sku || ''} — ${s.product_name || ''}`,
        formatQuantity(s.min_quantity),
        formatQuantity(s.current),
      ])
    )
  }

  const exportPopular = () => {
    downloadCsv(
      `popular_${new Date().toISOString().slice(0, 10)}`,
      [t('stock.product'), t('reports.shipped')],
      sortedPopular.map((p) => [`${p.product_sku || ''} — ${p.product_name || ''}`, formatQuantity(p.total_qty)])
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('reports.title')}</h1>
      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <>
          <h2 className={styles.h2}>{t('reports.shortage')}</h2>
          <TableToolbar
            search={searchShort}
            onSearchChange={(v) => {
              setSearchShort(v)
              setShortPage(1)
            }}
            onExport={exportShortage}
            exportDisabled={filteredShortage.length === 0}
          />
          <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('stock.product')} sortKey="product" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} />
                  <SortHeader className={styles.sortableHeader} label={t('reports.minQty')} sortKey="min" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} />
                  <SortHeader className={styles.sortableHeader} label={t('reports.current')} sortKey="current" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} />
                </tr>
              </thead>
              <tbody>
                {pagedShortage.map((s, i) => (
                  <tr key={`${s.product_id}-${i}`}>
                    <td>
                      {s.product_sku} — {s.product_name}
                    </td>
                    <td>{formatQuantity(s.min_quantity)}</td>
                    <td>{formatQuantity(s.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationDock}>
            <PaginationBar
              page={shortPage}
              pageCount={shortPages}
              total={sortedShortage.length}
              onPageChange={setShortPage}
              pageSize={shortPageSize}
              onPageSizeChange={(size) => {
                setShortPageSize(size)
                setShortPage(1)
              }}
              disabled={loading}
            />
          </div>
          </div>

          <h2 className={styles.h2}>{t('reports.popular')}</h2>
          <TableToolbar
            search={searchPop}
            onSearchChange={(v) => {
              setSearchPop(v)
              setPopPage(1)
            }}
            onExport={exportPopular}
            exportDisabled={filteredPopular.length === 0}
          />
          <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('stock.product')} sortKey="product" activeKey={popSort.key} sortDir={popSort.dir} onToggle={togglePopSort} />
                  <SortHeader className={styles.sortableHeader} label={t('reports.shipped')} sortKey="qty" activeKey={popSort.key} sortDir={popSort.dir} onToggle={togglePopSort} />
                </tr>
              </thead>
              <tbody>
                {pagedPopular.map((p, i) => (
                  <tr key={`${p.product}-${i}`}>
                    <td>
                      {p.product_sku} — {p.product_name}
                    </td>
                    <td>{formatQuantity(p.total_qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationDock}>
            <PaginationBar
              page={popPage}
              pageCount={popPages}
              total={sortedPopular.length}
              onPageChange={setPopPage}
              pageSize={popPageSize}
              onPageSizeChange={(size) => {
                setPopPageSize(size)
                setPopPage(1)
              }}
              disabled={loading}
            />
          </div>
          </div>
        </>
      )}
    </div>
  )
}
