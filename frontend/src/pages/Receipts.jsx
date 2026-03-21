import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { receipts as receiptsApi } from '../api'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './Table.module.css'

export default function Receipts() {
  const { t } = useTranslation()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    receiptsApi
      .suppliers({ page_size: 500 })
      .then((d) => setSuppliers(d.results || d || []))
      .catch(() => setSuppliers([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    receiptsApi
      .list({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        supplier: supplierId || undefined,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, supplierId])

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
        if (sortKey === 'employee') return String(row.created_by_username || '')
        if (sortKey === 'supplier') return String(row.supplier_name || '')
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
      const data = await receiptsApi.list({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        supplier: supplierId || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `receipts_${new Date().toISOString().slice(0, 10)}`,
        [t('receipts.id'), t('receipts.date'), t('receipts.employee'), t('receipts.supplier')],
        results.map((r) => [
          r.id,
          r.created_at?.slice(0, 19) ?? '',
          r.created_by_username || '',
          r.supplier_name || '',
        ])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('receipts.title')}</h1>
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
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value)
            setPage(1)
          }}
          aria-label={t('receipts.supplier')}
        >
          <option value="">{t('common.all')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
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
                  <SortHeader className={styles.sortableHeader} label={t('receipts.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('receipts.date')} sortKey="date" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('receipts.employee')} sortKey="employee" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('receipts.supplier')} sortKey="supplier" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.created_at?.slice(0, 10)}</td>
                    <td>{r.created_by_username || t('common.none')}</td>
                    <td>{r.supplier_name || t('common.none')}</td>
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
