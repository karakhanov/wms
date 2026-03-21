import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { inventory as inventoryApi, warehouse as warehouseApi } from '../api'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import StatusBadge from '../components/StatusBadge'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './Table.module.css'

export default function Inventory() {
  const { t } = useTranslation()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [warehouseId, setWarehouseId] = useState('')
  const [completed, setCompleted] = useState('')
  const [warehouses, setWarehouses] = useState([])
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    warehouseApi
      .warehouses({ page_size: 500 })
      .then((d) => setWarehouses(d.results || d || []))
      .catch(() => setWarehouses([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      warehouse: warehouseId || undefined,
    }
    if (completed === 'true') params.is_completed = true
    if (completed === 'false') params.is_completed = false
    inventoryApi
      .list(params)
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, warehouseId, completed])

  useEffect(() => {
    load()
  }, [load])

  const rows = (tableData.results || []).filter((r) => inDateRange(r.created_at, datePreset, dateFrom, dateTo))
  const sortedRows = useMemo(() => {
    const list = [...rows]
    const factor = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'id') return Number(row.id || 0)
        if (sortKey === 'date') return Date.parse(row.created_at || '') || 0
        if (sortKey === 'warehouse') return String(row.warehouse_name || '')
        if (sortKey === 'completed') return row.is_completed ? 1 : 0
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
      const params = {
        page_size: 200,
        search: debouncedSearch.trim() || undefined,
        warehouse: warehouseId || undefined,
      }
      if (completed === 'true') params.is_completed = true
      if (completed === 'false') params.is_completed = false
      const data = await inventoryApi.list(params)
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `inventory_${new Date().toISOString().slice(0, 10)}`,
        [t('inventory.id'), t('inventory.date'), t('inventory.warehouse'), t('inventory.completed')],
        results.map((inv) => [
          inv.id,
          inv.created_at?.slice(0, 19) ?? '',
          inv.warehouse_name || '',
          inv.is_completed ? t('common.yes') : t('common.no'),
        ])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('inventory.title')}</h1>
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
        <select
          className={toolbarStyles.filterSelect}
          value={completed}
          onChange={(e) => {
            setCompleted(e.target.value)
            setPage(1)
          }}
          aria-label={t('inventory.completed')}
        >
          <option value="">{t('common.all')}</option>
          <option value="false">{t('common.open')}</option>
          <option value="true">{t('common.completed')}</option>
        </select>
        <select className={toolbarStyles.filterSelect} value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(1) }}>
          <option value="">{t('common.allTime')}</option>
          <option value="today">{t('common.today')}</option>
          <option value="week">{t('common.thisWeek')}</option>
          <option value="month">{t('common.thisMonth')}</option>
          <option value="custom">{t('common.customRange')}</option>
        </select>
        {datePreset === 'custom' ? (
          <>
            <input className={toolbarStyles.filterSelect} type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} aria-label={t('common.dateFrom')} />
            <input className={toolbarStyles.filterSelect} type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} aria-label={t('common.dateTo')} />
          </>
        ) : null}
      </TableToolbar>
      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('inventory.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('inventory.date')} sortKey="date" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('inventory.warehouse')} sortKey="warehouse" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('inventory.completed')} sortKey="completed" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.id}</td>
                    <td>{inv.created_at?.slice(0, 10)}</td>
                    <td>{inv.warehouse_name || t('common.none')}</td>
                    <td>
                      <StatusBadge value={inv.is_completed ? t('common.yes') : t('common.no')} toneValue={inv.is_completed ? 'completed' : 'open'} />
                    </td>
                  </tr>
                ))}
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
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </div>
  )
}
