import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { notifications as notificationsApi } from '../api'
import { useAuth } from '../auth'
import { canViewNotifications } from '../permissions'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import StatusBadge from '../components/StatusBadge'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import PaginationBar from '../components/PaginationBar'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import toolbarStyles from '../components/TableToolbar.module.css'

export default function Notifications() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const canView = canViewNotifications(user)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const debouncedSearch = useDebouncedValue(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page_size: 300 }
      if (readFilter === 'read') params.is_read = true
      if (readFilter === 'unread') params.is_read = false
      const data = await notificationsApi.list(params)
      setRows(normalizeListResponse(data).results || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [readFilter])

  useEffect(() => {
    if (!canView) return
    load()
  }, [canView, load])

  const filteredRows = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase()
    return rows.filter((n) => {
      if (!inDateRange(n.created_at, datePreset, dateFrom, dateTo)) return false
      if (!q) return true
      return [n.title, n.message, n.type, n.entity_type, n.entity_id].join(' ').toLowerCase().includes(q)
    })
  }, [rows, debouncedSearch, datePreset, dateFrom, dateTo])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    const factor = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const value = (x) => {
        if (sortKey === 'type') return String(x.type || '')
        if (sortKey === 'title') return String(x.title || '')
        if (sortKey === 'is_read') return x.is_read ? 1 : 0
        if (sortKey === 'created_at') return Date.parse(x.created_at || '') || 0
        return ''
      }
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [filteredRows, sortKey, sortDir])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, readFilter, datePreset, dateFrom, dateTo, sortKey, sortDir])

  const pages = totalPages(sortedRows.length, pageSize)

  const typeLabel = (type) => t(`notifications.types.${type}`, { defaultValue: type || t('common.none') })
  const titleLabel = (n) =>
    t(`notifications.templates.${n.type}.title`, {
      number: n?.payload?.number || n?.entity_id || '',
      object_name: n?.payload?.object_name || t('common.none'),
      defaultValue: n?.title || t('common.none'),
    })
  const messageLabel = (n) =>
    t(`notifications.templates.${n.type}.message`, {
      number: n?.payload?.number || n?.entity_id || '',
      object_name: n?.payload?.object_name || t('common.none'),
      defaultValue: n?.message || t('common.none'),
    })

  const toggleSort = (key) => {
    setPage(1)
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const markRead = async (id) => {
    await notificationsApi.read(id)
    window.dispatchEvent(new Event('notifications:changed'))
    await load()
  }

  const markAllRead = async () => {
    await notificationsApi.readAll()
    window.dispatchEvent(new Event('notifications:changed'))
    await load()
  }

  const openEntity = async (n) => {
    if (!n?.id) return
    if (!n.is_read) {
      await notificationsApi.read(n.id)
      window.dispatchEvent(new Event('notifications:changed'))
    }
    if (n.entity_type === 'issue_note' && n.entity_id) {
      navigate(`/issue-notes?openNote=${n.entity_id}`)
      return
    }
    await load()
  }

  const exportCsv = () => {
    downloadCsv(
      `notifications-${new Date().toISOString().slice(0, 10)}.csv`,
      [t('notifications.type'), t('notifications.title'), t('notifications.message'), t('notifications.status'), t('notifications.date')],
      sortedRows.map((n) => [
        typeLabel(n.type),
        titleLabel(n),
        messageLabel(n),
        n.is_read ? t('notifications.read') : t('notifications.unread'),
        n.created_at?.slice(0, 10),
      ])
    )
  }

  if (!canView) {
    return <div className={styles.page}>{t('issueNotes.noAccess')}</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('notifications.title')}</h1>
        </div>
        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={markAllRead} disabled={loading}>
          {t('notifications.markAllRead')}
        </button>
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} onExport={exportCsv} exportDisabled={!sortedRows.length}>
        <select className={toolbarStyles.filterSelect} value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="unread">{t('notifications.unread')}</option>
          <option value="read">{t('notifications.read')}</option>
        </select>
        <select className={toolbarStyles.filterSelect} value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
          <option value="">{t('common.allTime')}</option>
          <option value="today">{t('common.today')}</option>
          <option value="week">{t('common.thisWeek')}</option>
          <option value="month">{t('common.thisMonth')}</option>
          <option value="custom">{t('common.customRange')}</option>
        </select>
        {datePreset === 'custom' ? (
          <>
            <input
              className={toolbarStyles.filterSelect}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label={t('common.dateFrom')}
            />
            <input
              className={toolbarStyles.filterSelect}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label={t('common.dateTo')}
            />
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
                  <SortHeader className={styles.sortableHeader} label={t('notifications.type')} sortKey="type" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('notifications.title')} sortKey="title" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <th>{t('notifications.message')}</th>
                  <SortHeader className={styles.sortableHeader} label={t('notifications.status')} sortKey="is_read" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('notifications.date')} sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((n) => (
                  <tr key={n.id}>
                    <td>{typeLabel(n.type)}</td>
                    <td>{titleLabel(n)}</td>
                    <td>{messageLabel(n)}</td>
                    <td>
                      <StatusBadge value={n.is_read ? t('notifications.read') : t('notifications.unread')} toneValue={n.is_read ? 'read' : 'unread'} />
                    </td>
                    <td>{n.created_at?.slice(0, 10)}</td>
                    <td>
                      {!n.is_read ? (
                        <button type="button" className={styles.btnSm} onClick={() => markRead(n.id)}>
                          {t('notifications.markRead')}
                        </button>
                      ) : null}{' '}
                      <button type="button" className={styles.btnSm} onClick={() => openEntity(n)}>
                        {t('notifications.open')}
                      </button>
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
              total={sortedRows.length}
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
