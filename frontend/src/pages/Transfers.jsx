import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { transfers as transfersApi } from '../api'
import ListPageDataPanel from '../components/ListPageDataPanel'
import EmptyState from '../components/EmptyState'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect, ToolbarFilterDateInput } from '../components/ToolbarControls'
import styles from './Table.module.css'

export default function Transfers() {
  const { t } = useTranslation()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const load = useCallback(() => {
    setLoading(true)
    transfersApi
      .list({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch])

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
  const rawOnPage = (tableData.results || []).length
  const listEmptyHint = useMemo(() => {
    if (sortedRows.length > 0) return ''
    if (rawOnPage > 0) return t('common.emptyStateFiltered')
    return t('common.emptyStateHintList')
  }, [sortedRows.length, rawOnPage, t])
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
      const data = await transfersApi.list({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `transfers_${new Date().toISOString().slice(0, 10)}`,
        [t('transfers.id'), t('transfers.date'), t('transfers.employee')],
        results.map((x) => [x.id, x.created_at?.slice(0, 19) ?? '', x.created_by_username || ''])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title={t('transfers.title')}
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
          <>
            <ToolbarFilterSelect value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(1) }}>
              <option value="">{t('common.allTime')}</option>
              <option value="today">{t('common.today')}</option>
              <option value="week">{t('common.thisWeek')}</option>
              <option value="month">{t('common.thisMonth')}</option>
              <option value="custom">{t('common.customRange')}</option>
            </ToolbarFilterSelect>
            {datePreset === 'custom' ? (
              <>
                <ToolbarFilterDateInput type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} aria-label={t('common.dateFrom')} />
                <ToolbarFilterDateInput type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} aria-label={t('common.dateTo')} />
              </>
            ) : null}
          </>
        )}
      >
        <div className={styles.listTableShell}>
          {sortedRows.length === 0 ? (
            <EmptyState hint={listEmptyHint} compact />
          ) : (
            <DataTable
              columns={[
                { key: 'id', header: <SortHeader className={styles.sortableHeader} label={t('transfers.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'date', header: <SortHeader className={styles.sortableHeader} label={t('transfers.date')} sortKey="date" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'employee', header: <SortHeader className={styles.sortableHeader} label={t('transfers.employee')} sortKey="employee" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
              ]}
              rows={sortedRows}
              rowKey="id"
              selection={{
                selectedIds,
                onToggleAll: (checked) => setSelectedIds(checked ? new Set(sortedRows.map((x) => x.id)) : new Set()),
                onToggleOne: (id, checked) => {
                  const next = new Set(selectedIds)
                  if (checked) next.add(id)
                  else next.delete(id)
                  setSelectedIds(next)
                },
              }}
              renderCell={(x, col) => {
                if (col.key === 'id') return x.id
                if (col.key === 'date') return x.created_at?.slice(0, 10)
                if (col.key === 'employee') return x.created_by_username || t('common.none')
                return null
              }}
              page={page}
              pageCount={pages}
              total={count}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              disabled={loading}
              bulkActions={
                <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
                  {t('common.exportExcel')}
                </button>
              }
            />
          )}
        </div>
      </ListPageDataPanel>
    </div>
  )
}
