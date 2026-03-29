import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { stock as stockApi, warehouse as warehouseApi } from '../api'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { formatQuantity } from '../utils/formatQuantity'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import formStyles from './Form.module.css'
import styles from './Table.module.css'

function photoUrl(photo) {
  if (!photo) return null
  const s = String(photo)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

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
  const [sortKey, setSortKey] = useState('sku')
  const [sortDir, setSortDir] = useState('asc')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    warehouseApi
      .warehouses({ page_size: 500 })
      .then((d) => setWarehouses(d.results || d || []))
      .catch(() => setWarehouses([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    stockApi
      .balances({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        cell__rack__zone__warehouse: warehouseId || undefined,
      })
      .then((d) => {
        setTableData(normalizeListResponse(d))
      })
      .catch((err) => {
        const d = err?.response?.data?.detail
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x) => (typeof x === 'string' ? x : x?.message || String(x))).join(' ')
              : ''
        setLoadError(msg.trim() || t('stock.loadError'))
        setTableData({ results: [], count: 0 })
      })
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, warehouseId, t])

  useEffect(() => {
    load()
  }, [load])

  const rows = tableData.results || []
  const sortedRows = useMemo(() => {
    const list = [...rows]
    const factor = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'sku') return String(row.product_sku || '')
        if (sortKey === 'name') return String(row.product_name || '')
        if (sortKey === 'barcode') return String(row.product_barcode || '')
        if (sortKey === 'category') return String(row.product_category_name || '')
        if (sortKey === 'unit') return String(row.product_unit || '')
        if (sortKey === 'warehouse') return String(row.warehouse_name || '')
        if (sortKey === 'zone') return String(row.zone_name || '')
        if (sortKey === 'quantity') return Number(row.quantity || 0)
        if (sortKey === 'updated') return String(row.updated_at || '')
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
        [
          t('products.sku'),
          t('products.name'),
          t('products.barcode'),
          t('products.category'),
          t('products.unit'),
          t('stock.warehouse'),
          t('stock.zone'),
          t('stock.quantity'),
          t('stock.updatedAt'),
        ],
        results.map((b) => [
          b.product_sku || '',
          b.product_name || '',
          b.product_barcode || '',
          b.product_category_name || '',
          b.product_unit || '',
          b.warehouse_name || '',
          b.zone_name || '',
          formatQuantity(b.quantity),
          b.updated_at ? String(b.updated_at).replace('T', ' ').slice(0, 19) : '',
        ])
      )
    } catch {
      /* empty */
    }
  }

  const colCount = 10

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('stock.title')}</h1>
          <p className={styles.lead}>{t('stock.lead')}</p>
        </div>
      </div>

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

      {!loading && loadError ? <div className={formStyles.error}>{loadError}</div> : null}

      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('common.photo')}</th>
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('products.sku')}
                    sortKey="sku"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('products.name')}
                    sortKey="name"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('products.barcode')}
                    sortKey="barcode"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('products.category')}
                    sortKey="category"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('products.unit')}
                    sortKey="unit"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('stock.warehouse')}
                    sortKey="warehouse"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('stock.zone')}
                    sortKey="zone"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('stock.quantity')}
                    sortKey="quantity"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    className={styles.sortableHeader}
                    label={t('stock.updatedAt')}
                    sortKey="updated"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {!sortedRows.length && !loadError ? (
                  <tr>
                    <td colSpan={colCount} className={styles.emptyTableMsg}>
                      {rows.length === 0 && !debouncedSearch.trim() && !warehouseId
                        ? t('stock.emptyList')
                        : t('stock.emptyFiltered')}
                    </td>
                  </tr>
                ) : sortedRows.length ? (
                  sortedRows.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.product_photo ? (
                          <img src={photoUrl(b.product_photo)} alt="" className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbPlaceholder}>—</span>
                        )}
                      </td>
                      <td>{b.product_sku || t('common.none')}</td>
                      <td>{b.product_name || t('common.none')}</td>
                      <td>{b.product_barcode || t('common.none')}</td>
                      <td>{b.product_category_name || t('common.none')}</td>
                      <td>{b.product_unit || t('common.none')}</td>
                      <td>{b.warehouse_name || t('common.none')}</td>
                      <td>{b.zone_name || t('common.none')}</td>
                      <td>{formatQuantity(b.quantity)}</td>
                      <td>
                        {b.updated_at
                          ? String(b.updated_at).replace('T', ' ').slice(0, 19)
                          : t('common.none')}
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationDock}>
            <PaginationBar
              page={page}
              pageCount={pages}
              total={count}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </div>
  )
}
