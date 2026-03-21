import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { stock as stockApi, warehouse as warehouseApi } from '../api'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './Table.module.css'

export default function Stock() {
  const { t } = useTranslation()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState([])
  const [sortKey, setSortKey] = useState('product')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    warehouseApi
      .warehouses({ page_size: 500 })
      .then((d) => setWarehouses(d.results || d || []))
      .catch(() => setWarehouses([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    stockApi
      .balances({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        cell__rack__zone__warehouse: warehouseId || undefined,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, warehouseId])

  useEffect(() => {
    load()
  }, [load])

  const rows = tableData.results || []
  const sortedRows = useMemo(() => {
    const list = [...rows]
    const factor = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'product') return `${row.product_sku || ''} ${row.product_name || ''}`
        if (sortKey === 'cell') return String(row.cell_name || '')
        if (sortKey === 'quantity') return Number(row.quantity || 0)
        return ''
      }
      const av = pick(a)
      const bv = pick(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [rows, sortKey, sortDir])
  const count = tableData.count ?? rows.length
  const pages = totalPages(count, pageSize)
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const exportCsv = async () => {
    try {
      const data = await stockApi.balances({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        cell__rack__zone__warehouse: warehouseId || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `stock_${new Date().toISOString().slice(0, 10)}`,
        [t('stock.product'), t('stock.cell'), t('stock.quantity')],
        results.map((b) => [`${b.product_sku} — ${b.product_name}`, b.cell_name, b.quantity])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('stock.title')}</h1>
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onExport={exportCsv}
        exportDisabled={loading}
      >
        <select
          className={toolbarStyles.filterSelect}
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value)
            setPage(1)
          }}
          aria-label={t('inventory.warehouse')}
        >
          <option value="">{t('common.all')}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.name}
            </option>
          ))}
        </select>
      </TableToolbar>
      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('stock.product')} sortKey="product" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('stock.cell')} sortKey="cell" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('stock.quantity')} sortKey="quantity" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.product_sku} — {b.product_name}
                    </td>
                    <td>{b.cell_name}</td>
                    <td>{b.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationDock}>
            <PaginationBar page={page} pageCount={pages} total={count} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} disabled={loading} />
          </div>
        </div>
      )}
    </div>
  )
}
