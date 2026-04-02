import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { stock as stockApi, warehouse as warehouseApi } from '../api'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { formatQuantity } from '../utils/formatQuantity'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'
import formStyles from './Form.module.css'
import styles from './Table.module.css'
import stockStyles from './Stock.module.css'
import { IconNav } from '../ui/Icons'

const COLS_STORAGE = 'wms.stock.columns.v1'

const DEFAULT_VISIBILITY = {
  photo: true,
  sku: true,
  name: true,
  barcode: false,
  category: true,
  unit: true,
  location: true,
  quantity: true,
  updated: false,
}

const SORT_TO_API = {
  sku: 'product__sku',
  name: 'product__name',
  barcode: 'product__barcode',
  category: 'product__category__name',
  unit: 'product__unit',
  location: 'cell__rack__zone__warehouse__name',
  quantity: 'quantity',
  updated: 'updated_at',
}

function readStoredCols() {
  try {
    const s = localStorage.getItem(COLS_STORAGE)
    if (!s) return null
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(s) }
  } catch {
    return null
  }
}

function balancePhotoUrl(b) {
  const v = b.product_photo_url || b.product_photo
  if (!v) return null
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

function buildOrdering(sortKey, sortDir) {
  const field = SORT_TO_API[sortKey] || 'quantity'
  return (sortDir === 'desc' ? '-' : '') + field
}

function warehouseZoneLine(b, noneLabel) {
  const w = (b.warehouse_name || '').trim()
  const z = (b.zone_name || '').trim()
  if (!w && !z) return noneLabel
  if (w && z) return `${w} / ${z}`
  return w || z
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
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBILITY)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [colsOpen, setColsOpen] = useState(false)
  const colsWrapRef = useRef(null)
  const skipPersistCols = useRef(true)
  const loadedFromStorage = useRef(false)
  const heuristicApplied = useRef(false)

  useEffect(() => {
    const x = readStoredCols()
    if (x) {
      loadedFromStorage.current = true
      setVisibleCols(x)
    }
  }, [])

  useEffect(() => {
    if (skipPersistCols.current) {
      skipPersistCols.current = false
      return
    }
    try {
      localStorage.setItem(COLS_STORAGE, JSON.stringify(visibleCols))
    } catch {
      /* ignore */
    }
  }, [visibleCols])

  useEffect(() => {
    warehouseApi
      .warehouses({ page_size: 500 })
      .then((d) => setWarehouses(d.results || d || []))
      .catch(() => setWarehouses([]))
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      if (colsWrapRef.current && !colsWrapRef.current.contains(e.target)) setColsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
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
        ordering: buildOrdering(sortKey, sortDir),
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
  }, [page, pageSize, debouncedSearch, warehouseId, sortKey, sortDir, t])

  useEffect(() => {
    load()
  }, [load])

  const rows = tableData.results || []

  useEffect(() => {
    if (loadedFromStorage.current || heuristicApplied.current) return
    if (!rows.length) return
    heuristicApplied.current = true
    const anyDistinct = rows.some((r) => {
      const bc = String(r.product_barcode || '').trim()
      const sk = String(r.product_sku || '').trim()
      return bc.length > 0 && bc !== sk
    })
    if (anyDistinct) setVisibleCols((v) => ({ ...v, barcode: true }))
  }, [rows])

  const count = tableData.count ?? rows.length
  const pages = totalPages(count, pageSize)

  const toggleSort = (key) => {
    setPage(1)
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const tableColumns = useMemo(() => {
    const cols = []
    if (visibleCols.photo) cols.push({ key: 'photo', header: t('common.photo') })
    if (visibleCols.sku) cols.push({ key: 'sku', header: <SortHeader className={styles.sortableHeader} label={t('products.sku')} sortKey="sku" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.name) cols.push({ key: 'name', header: <SortHeader className={styles.sortableHeader} label={t('products.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.barcode) cols.push({ key: 'barcode', header: <SortHeader className={styles.sortableHeader} label={t('products.barcode')} sortKey="barcode" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.category) cols.push({ key: 'category', header: <SortHeader className={styles.sortableHeader} label={t('products.category')} sortKey="category" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.unit) cols.push({ key: 'unit', header: <SortHeader className={styles.sortableHeader} label={t('products.unit')} sortKey="unit" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.location) cols.push({ key: 'location', header: <SortHeader className={styles.sortableHeader} label={t('stock.warehouseZone')} sortKey="location" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.quantity) cols.push({ key: 'quantity', header: <SortHeader className={styles.sortableHeader} label={t('stock.quantity')} sortKey="quantity" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    if (visibleCols.updated) cols.push({ key: 'updated', header: <SortHeader className={styles.sortableHeader} label={t('stock.updatedAt')} sortKey="updated" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} showInactiveHint /> })
    return cols
  }, [visibleCols, t, sortKey, sortDir])

  const toggleCol = (key) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      const anyVisible = Object.values(next).some(Boolean)
      return anyVisible ? next : prev
    })
  }

  const exportCsv = async () => {
    try {
      const data = await stockApi.balances({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        cell__rack__zone__warehouse: warehouseId || undefined,
        ordering: buildOrdering(sortKey, sortDir),
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

  const colToggles = [
    { key: 'photo', label: t('common.photo') },
    { key: 'sku', label: t('products.sku') },
    { key: 'name', label: t('products.name') },
    { key: 'barcode', label: t('products.barcode') },
    { key: 'category', label: t('products.category') },
    { key: 'unit', label: t('products.unit') },
    { key: 'location', label: t('stock.warehouseZone') },
    { key: 'quantity', label: t('stock.quantity') },
    { key: 'updated', label: t('stock.updatedAt') },
  ]

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title={t('stock.title')}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
            {t('common.exportExcel')}
          </button>
        )}
        search={(
          <ToolbarSearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.searchPlaceholder')}
          />
        )}
        filters={(
          <div className={stockStyles.toolbarFiltersRow}>
            <ToolbarFilterSelect
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
            </ToolbarFilterSelect>
            <div className={stockStyles.columnsWrap} ref={colsWrapRef}>
              <button
                type="button"
                className={stockStyles.columnsBtn}
                aria-expanded={colsOpen}
                aria-haspopup="true"
                onClick={() => setColsOpen((o) => !o)}
              >
                {t('stock.columns')}
              </button>
              {colsOpen ? (
                <div className={stockStyles.columnsPopover} role="dialog" aria-label={t('stock.columnsTitle')}>
                  <p className={stockStyles.columnsPopoverTitle}>{t('stock.columnsTitle')}</p>
                  <ul className={stockStyles.columnsList}>
                    {colToggles.map(({ key, label }) => (
                      <li key={key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={visibleCols[key]}
                            onChange={() => toggleCol(key)}
                          />
                          {label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}
      >
        {!loading && loadError ? <div className={formStyles.error}>{loadError}</div> : null}
        {!loading && !loadError ? (
          <DataTable
            columns={tableColumns}
            rows={rows}
            rowKey="id"
            selection={{
              selectedIds,
              onToggleAll: (checked) => setSelectedIds(checked ? new Set(rows.map((b) => b.id)) : new Set()),
              onToggleOne: (id, checked) => {
                const next = new Set(selectedIds)
                if (checked) next.add(id)
                else next.delete(id)
                setSelectedIds(next)
              },
            }}
            renderCell={(b, col) => {
              if (col.key === 'photo') return balancePhotoUrl(b) ? <img src={balancePhotoUrl(b)} alt="" className={styles.thumb} /> : <span className={styles.thumbPlaceholder} aria-hidden><IconNav name="products" size={20} /></span>
              if (col.key === 'sku') return b.product_sku || t('common.none')
              if (col.key === 'name') return b.product_name || t('common.none')
              if (col.key === 'barcode') return b.product_barcode || t('common.none')
              if (col.key === 'category') return b.product_category_name || t('common.none')
              if (col.key === 'unit') return b.product_unit || t('common.none')
              if (col.key === 'location') return warehouseZoneLine(b, t('common.none'))
              if (col.key === 'quantity') return formatQuantity(b.quantity)
              if (col.key === 'updated') return b.updated_at ? String(b.updated_at).replace('T', ' ').slice(0, 19) : t('common.none')
              return null
            }}
            emptyText={!debouncedSearch.trim() && !warehouseId ? t('stock.emptyList') : t('stock.emptyFiltered')}
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
            bulkActions={
              <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
                {t('common.exportExcel')}
              </button>
            }
          />
        ) : null}
      </ListPageDataPanel>
    </div>
  )
}
