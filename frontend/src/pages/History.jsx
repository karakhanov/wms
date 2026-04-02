import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { users as usersApi } from '../api'
import { useAuth } from '../auth'
import { canViewHistory, isAdmin } from '../permissions'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { actionLogDateParams } from '../utils/historyApiParams'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect, ToolbarFilterDateInput } from '../components/ToolbarControls'
import styles from './Table.module.css'
import hStyles from './History.module.css'
import { friendlyHistoryAction, historyActionTooltip } from '../utils/historyActionLabel'

function methodBadgeClass(method, hs) {
  const m = (method || '').toUpperCase()
  if (m === 'GET' || m === 'HEAD') return hs.methodGet
  if (m === 'POST') return hs.methodPost
  if (m === 'PUT' || m === 'PATCH') return hs.methodPut
  if (m === 'DELETE') return hs.methodDelete
  if (m === 'VIEW') return hs.methodView
  return hs.methodDefault
}

function statusCodeBadgeClass(code, hs) {
  const n = Number(code)
  if (!Number.isFinite(n)) return hs.statusOther
  if (n >= 200 && n < 300) return hs.status2xx
  if (n >= 400 && n < 500) return hs.status4xx
  if (n >= 500 && n < 600) return hs.status5xx
  return hs.statusOther
}

export default function History() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canView = canViewHistory(user)
  const admin = isAdmin(user)
  const [rowsData, setRowsData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [usersList, setUsersList] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')
  const [pageFilter, setPageFilter] = useState('')
  const [authOnly, setAuthOnly] = useState(false)
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const debouncedSearch = useDebouncedValue(search, 300)
  const [facetPages, setFacetPages] = useState([])
  const [facetDevices, setFacetDevices] = useState([])

  useEffect(() => {
    if (!admin) return
    usersApi
      .list({ page_size: 500 })
      .then((d) => setUsersList(normalizeListResponse(d).results || []))
      .catch(() => setUsersList([]))
  }, [admin])

  useEffect(() => {
    if (!canView) return
    usersApi
      .actionLogFacets()
      .then((d) => {
        setFacetPages(Array.isArray(d?.pages) ? d.pages : [])
        setFacetDevices(Array.isArray(d?.devices) ? d.devices : [])
      })
      .catch(() => {
        setFacetPages([])
        setFacetDevices([])
      })
  }, [canView])

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      method: methodFilter || undefined,
      device: deviceFilter || undefined,
      auth_only: authOnly ? true : undefined,
      ordering: `${sortDir === 'desc' ? '-' : ''}${sortKey}`,
      section: pageFilter || undefined,
      ...actionLogDateParams(datePreset, dateFrom, dateTo),
    }
    if (admin && userFilter) params.created_by = userFilter
    usersApi
      .actionLog(params)
      .then((d) => setRowsData(normalizeListResponse(d)))
      .catch(() => setRowsData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [
    page,
    pageSize,
    debouncedSearch,
    methodFilter,
    deviceFilter,
    pageFilter,
    authOnly,
    sortKey,
    sortDir,
    admin,
    userFilter,
    datePreset,
    dateFrom,
    dateTo,
  ])

  useEffect(() => {
    if (!canView) return
    load()
  }, [canView, load])

  const rows = rowsData.results || []
  const count = rowsData.count ?? 0
  const pages = totalPages(count, pageSize)
  const deviceOptions = facetDevices
  const pageOptions = facetPages

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const pageLabel = (row) => row?.details?.page_path || row.page || row.model_name || t('common.none')

  const exportCsv = async () => {
    const params = {
      page_size: 500,
      search: debouncedSearch.trim() || undefined,
      method: methodFilter || undefined,
      device: deviceFilter || undefined,
      auth_only: authOnly ? true : undefined,
      ordering: `${sortDir === 'desc' ? '-' : ''}${sortKey}`,
      section: pageFilter || undefined,
      ...actionLogDateParams(datePreset, dateFrom, dateTo),
    }
    if (admin && userFilter) params.created_by = userFilter
    const data = await usersApi.actionLog(params)
    const list = normalizeListResponse(data).results || []
    downloadCsv(
      `history-${new Date().toISOString().slice(0, 10)}.csv`,
      [t('history.time'), t('history.user'), t('history.page'), t('history.action'), t('history.method'), t('history.statusCode'), t('history.ip'), t('history.device')],
      list.map((r) => [r.created_at?.slice(0, 19), r.created_by_username, pageLabel(r), friendlyHistoryAction(r, t), r.method, r.status_code, r.ip_address, r.device])
    )
  }

  if (!canView) return <div className={styles.page}>{t('issueNotes.noAccess')}</div>

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title={t('history.title')}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
            {t('common.exportExcel')}
          </button>
        )}
        filters={(
          <div className={hStyles.historyToolbarInner}>
            <div className={hStyles.historySearchWrap}>
              <ToolbarSearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={t('common.searchPlaceholder')}
                aria-label={t('common.searchPlaceholder')}
              />
            </div>
            {admin && (
              <ToolbarFilterSelect value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}>
                <option value="">{t('history.allUsers')}</option>
                {usersList.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </ToolbarFilterSelect>
            )}
            <ToolbarFilterSelect value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }}>
              <option value="">{t('history.allMethods')}</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="VIEW">VIEW</option>
            </ToolbarFilterSelect>
            <ToolbarFilterSelect value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(1) }}>
              <option value="">{t('history.allTime')}</option>
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
            <ToolbarFilterSelect value={pageFilter} onChange={(e) => { setPageFilter(e.target.value); setPage(1) }}>
              <option value="">{t('history.allPages')}</option>
              {pageOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </ToolbarFilterSelect>
            <ToolbarFilterSelect value={deviceFilter} onChange={(e) => { setDeviceFilter(e.target.value); setPage(1) }}>
              <option value="">{t('history.allDevices')}</option>
              {deviceOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </ToolbarFilterSelect>
            <label className={`${panelStyles.toolbarControl} ${panelStyles.toolbarCheckboxLabel}`}>
              <input type="checkbox" checked={authOnly} onChange={(e) => { setAuthOnly(e.target.checked); setPage(1) }} />
              {t('history.authOnly')}
            </label>
          </div>
        )}
      >
        <DataTable
          columns={[
            { key: 'time', header: <SortHeader className={styles.sortableHeader} label={t('history.time')} sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'user', header: <SortHeader className={styles.sortableHeader} label={t('history.user')} sortKey="created_by" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'page', header: <SortHeader className={styles.sortableHeader} label={t('history.page')} sortKey="page" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'action', header: t('history.action') },
            { key: 'method', header: <SortHeader className={styles.sortableHeader} label={t('history.method')} sortKey="method" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'status_code', header: <SortHeader className={styles.sortableHeader} label={t('history.statusCode')} sortKey="status_code" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'ip', header: t('history.ip') },
            { key: 'device', header: <SortHeader className={styles.sortableHeader} label={t('history.device')} sortKey="device" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
          ]}
          rows={rows}
          rowKey="id"
          selection={{
            selectedIds,
            onToggleAll: (checked) => setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set()),
            onToggleOne: (id, checked) => {
              const next = new Set(selectedIds)
              if (checked) next.add(id)
              else next.delete(id)
              setSelectedIds(next)
            },
          }}
          renderCell={(r, col) => {
            const actionTip = historyActionTooltip(r)
            const friendlyAction = friendlyHistoryAction(r, t)
            if (col.key === 'time') return r.created_at?.slice(0, 19).replace('T', ' ')
            if (col.key === 'user') return r.created_by_username || t('common.none')
            if (col.key === 'page') return pageLabel(r)
            if (col.key === 'action') return <span className={hStyles.actionCol} title={actionTip || undefined}>{friendlyAction}</span>
            if (col.key === 'method') return r.method ? <span className={`${hStyles.methodBadge} ${methodBadgeClass(r.method, hStyles)}`}>{r.method}</span> : t('common.none')
            if (col.key === 'status_code') return r.status_code != null && r.status_code !== '' ? <span className={`${hStyles.statusBadge} ${statusCodeBadgeClass(r.status_code, hStyles)}`}>{r.status_code}</span> : t('common.none')
            if (col.key === 'ip') return <span title={r.user_agent || undefined}>{r.ip_address || t('common.none')}</span>
            if (col.key === 'device') return r.device || t('common.none')
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
      </ListPageDataPanel>
    </div>
  )
}
