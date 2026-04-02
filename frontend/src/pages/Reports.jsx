import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import ListPageDataPanel from '../components/ListPageDataPanel'
import EmptyState from '../components/EmptyState'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { downloadCsv } from '../utils/csvExport'
import { totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { formatQuantity } from '../utils/formatQuantity'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput } from '../components/ToolbarControls'
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
  const [shortSelectedIds, setShortSelectedIds] = useState(new Set())
  const [popSelectedIds, setPopSelectedIds] = useState(new Set())

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

  const shortEmptyHint = useMemo(() => {
    if (sortedShortage.length > 0) return ''
    if (shortage.length > 0) return t('common.emptyStateFiltered')
    return t('common.reportsEmptyHint')
  }, [sortedShortage.length, shortage.length, t])

  const popEmptyHint = useMemo(() => {
    if (sortedPopular.length > 0) return ''
    if (popular.length > 0) return t('common.emptyStateFiltered')
    return t('common.reportsEmptyHint')
  }, [sortedPopular.length, popular.length, t])

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
      {loading ? (
        <ListPageDataPanel flushTop title={t('reports.title')} filters={<></>} loading />
      ) : (
        <>
          <ListPageDataPanel
            flushTop
            title={t('reports.shortage')}
            titleTag="h2"
            exportButton={(
              <button type="button" className={toolbarStyles.btnExport} onClick={exportShortage} disabled={filteredShortage.length === 0}>
                {t('common.exportExcel')}
              </button>
            )}
            search={(
              <ToolbarSearchInput
                value={searchShort}
                onChange={(e) => {
                  setSearchShort(e.target.value)
                  setShortPage(1)
                }}
                placeholder={t('common.searchPlaceholder')}
                aria-label={t('reports.shortage')}
              />
            )}
            filters={null}
          >
            <div className={styles.listTableShell}>
              {sortedShortage.length === 0 ? (
                <EmptyState hint={shortEmptyHint} compact />
              ) : (
                <DataTable
                  columns={[
                    { key: 'product', header: <SortHeader className={styles.sortableHeader} label={t('stock.product')} sortKey="product" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} /> },
                    { key: 'min', header: <SortHeader className={styles.sortableHeader} label={t('reports.minQty')} sortKey="min" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} /> },
                    { key: 'current', header: <SortHeader className={styles.sortableHeader} label={t('reports.current')} sortKey="current" activeKey={shortSort.key} sortDir={shortSort.dir} onToggle={toggleShortSort} /> },
                  ]}
                  rows={pagedShortage}
                  rowKey={(s) => `${s.product_id || s.product_sku || s.product_name}`}
                  selection={{
                    selectedIds: shortSelectedIds,
                    onToggleAll: (checked) => setShortSelectedIds(checked ? new Set(pagedShortage.map((s) => `${s.product_id || s.product_sku || s.product_name}`)) : new Set()),
                    onToggleOne: (id, checked) => {
                      const next = new Set(shortSelectedIds)
                      if (checked) next.add(id)
                      else next.delete(id)
                      setShortSelectedIds(next)
                    },
                  }}
                  renderCell={(s, col) => {
                    if (col.key === 'product') return `${s.product_sku || ''} — ${s.product_name || ''}`
                    if (col.key === 'min') return formatQuantity(s.min_quantity)
                    if (col.key === 'current') return formatQuantity(s.current)
                    return null
                  }}
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
                  bulkActions={
                    <button type="button" className={toolbarStyles.btnExport} onClick={exportShortage} disabled={filteredShortage.length === 0}>
                      {t('common.exportExcel')}
                    </button>
                  }
                />
              )}
            </div>
          </ListPageDataPanel>

          <ListPageDataPanel
            title={t('reports.popular')}
            titleTag="h2"
            exportButton={(
              <button type="button" className={toolbarStyles.btnExport} onClick={exportPopular} disabled={filteredPopular.length === 0}>
                {t('common.exportExcel')}
              </button>
            )}
            search={(
              <ToolbarSearchInput
                value={searchPop}
                onChange={(e) => {
                  setSearchPop(e.target.value)
                  setPopPage(1)
                }}
                placeholder={t('common.searchPlaceholder')}
                aria-label={t('reports.popular')}
              />
            )}
            filters={null}
          >
            <div className={styles.listTableShell}>
              {sortedPopular.length === 0 ? (
                <EmptyState hint={popEmptyHint} compact />
              ) : (
                <DataTable
                  columns={[
                    { key: 'product', header: <SortHeader className={styles.sortableHeader} label={t('stock.product')} sortKey="product" activeKey={popSort.key} sortDir={popSort.dir} onToggle={togglePopSort} /> },
                    { key: 'qty', header: <SortHeader className={styles.sortableHeader} label={t('reports.shipped')} sortKey="qty" activeKey={popSort.key} sortDir={popSort.dir} onToggle={togglePopSort} /> },
                  ]}
                  rows={pagedPopular}
                  rowKey={(p) => `${p.product || p.product_sku || p.product_name}`}
                  selection={{
                    selectedIds: popSelectedIds,
                    onToggleAll: (checked) => setPopSelectedIds(checked ? new Set(pagedPopular.map((p) => `${p.product || p.product_sku || p.product_name}`)) : new Set()),
                    onToggleOne: (id, checked) => {
                      const next = new Set(popSelectedIds)
                      if (checked) next.add(id)
                      else next.delete(id)
                      setPopSelectedIds(next)
                    },
                  }}
                  renderCell={(p, col) => {
                    if (col.key === 'product') return `${p.product_sku || ''} — ${p.product_name || ''}`
                    if (col.key === 'qty') return formatQuantity(p.total_qty)
                    return null
                  }}
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
                  bulkActions={
                    <button type="button" className={toolbarStyles.btnExport} onClick={exportPopular} disabled={filteredPopular.length === 0}>
                      {t('common.exportExcel')}
                    </button>
                  }
                />
              )}
            </div>
          </ListPageDataPanel>
        </>
      )}
    </div>
  )
}
