import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { users as usersApi } from '../api'
import { useAuth } from '../auth'
import { canViewHistory, isAdmin } from '../permissions'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { actionLogDateParams } from '../utils/historyApiParams'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './Table.module.css'

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

  const actionLabel = (row) => {
    if (row.action === 'AUTH_LOGIN') return t('history.authLogin')
    if (row.action === 'AUTH_LOGOUT') return t('history.authLogout')
    if (row.action === 'AUTH_LOGIN_FAILED') return t('history.authLoginFailed')
    if (row.action === 'PAGE_VIEW') return t('history.pageView')
    return row.action
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
      list.map((r) => [r.created_at?.slice(0, 19), r.created_by_username, pageLabel(r), actionLabel(r), r.method, r.status_code, r.ip_address, r.device])
    )
  }

  if (!canView) return <div className={styles.page}>{t('issueNotes.noAccess')}</div>

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('history.title')}</h1>
        </div>
      </div>

      <TableToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1) }} onExport={exportCsv} exportDisabled={loading}>
        {admin && (
          <select className={toolbarStyles.filterSelect} value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}>
            <option value="">{t('history.allUsers')}</option>
            {usersList.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        )}
        <select className={toolbarStyles.filterSelect} value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }}>
          <option value="">{t('history.allMethods')}</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="VIEW">VIEW</option>
        </select>
        <select className={toolbarStyles.filterSelect} value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(1) }}>
          <option value="">{t('history.allTime')}</option>
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
        <select className={toolbarStyles.filterSelect} value={pageFilter} onChange={(e) => { setPageFilter(e.target.value); setPage(1) }}>
          <option value="">{t('history.allPages')}</option>
          {pageOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={toolbarStyles.filterSelect} value={deviceFilter} onChange={(e) => { setDeviceFilter(e.target.value); setPage(1) }}>
          <option value="">{t('history.allDevices')}</option>
          {deviceOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className={toolbarStyles.filterSelect} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={authOnly} onChange={(e) => { setAuthOnly(e.target.checked); setPage(1) }} />
          {t('history.authOnly')}
        </label>
      </TableToolbar>

      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('history.time')} sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('history.user')} sortKey="created_by" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('history.page')} sortKey="page" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <th>{t('history.action')}</th>
                  <SortHeader className={styles.sortableHeader} label={t('history.method')} sortKey="method" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('history.statusCode')} sortKey="status_code" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <th>{t('history.ip')}</th>
                  <SortHeader className={styles.sortableHeader} label={t('history.device')} sortKey="device" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.created_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td>{r.created_by_username || t('common.none')}</td>
                    <td>{pageLabel(r)}</td>
                    <td title={r.user_agent || ''}>{actionLabel(r)}</td>
                    <td>{r.method || t('common.none')}</td>
                    <td>{r.status_code || t('common.none')}</td>
                    <td>{r.ip_address || t('common.none')}</td>
                    <td>{r.device || t('common.none')}</td>
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
