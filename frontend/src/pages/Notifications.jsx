import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { notifications as notificationsApi } from '../api'
import { useAuth } from '../auth'
import { canViewNotifications } from '../permissions'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import StatusBadge from '../components/StatusBadge'
import DataTable from '../components/DataTable'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect, ToolbarFilterDateInput } from '../components/ToolbarControls'

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
  const [selectedIds, setSelectedIds] = useState(new Set())
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
      <ListPageDataPanel
        flushTop
        title={t('notifications.title')}
        leadExtra={(
          <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={markAllRead} disabled={loading}>
            {t('notifications.markAllRead')}
          </button>
        )}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={!sortedRows.length}>
            {t('common.exportExcel')}
          </button>
        )}
        search={(
          <ToolbarSearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.searchPlaceholder')}
          />
        )}
        filters={(
          <>
            <ToolbarFilterSelect value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
              <option value="">{t('common.all')}</option>
              <option value="unread">{t('notifications.unread')}</option>
              <option value="read">{t('notifications.read')}</option>
            </ToolbarFilterSelect>
            <ToolbarFilterSelect value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
              <option value="">{t('common.allTime')}</option>
              <option value="today">{t('common.today')}</option>
              <option value="week">{t('common.thisWeek')}</option>
              <option value="month">{t('common.thisMonth')}</option>
              <option value="custom">{t('common.customRange')}</option>
            </ToolbarFilterSelect>
            {datePreset === 'custom' ? (
              <>
                <ToolbarFilterDateInput
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label={t('common.dateFrom')}
                />
                <ToolbarFilterDateInput
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label={t('common.dateTo')}
                />
              </>
            ) : null}
          </>
        )}
      >
        <DataTable
          columns={[
            { key: 'type', header: <SortHeader className={styles.sortableHeader} label={t('notifications.type')} sortKey="type" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'title', header: <SortHeader className={styles.sortableHeader} label={t('notifications.title')} sortKey="title" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'message', header: t('notifications.message') },
            { key: 'status', header: <SortHeader className={styles.sortableHeader} label={t('notifications.status')} sortKey="is_read" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'date', header: <SortHeader className={styles.sortableHeader} label={t('notifications.date')} sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'actions', header: t('common.actions') },
          ]}
          rows={pagedRows}
          rowKey="id"
          selection={{
            selectedIds,
            onToggleAll: (checked) => setSelectedIds(checked ? new Set(pagedRows.map((n) => n.id)) : new Set()),
            onToggleOne: (id, checked) => {
              const next = new Set(selectedIds)
              if (checked) next.add(id)
              else next.delete(id)
              setSelectedIds(next)
            },
          }}
          renderCell={(n, col) => {
            if (col.key === 'type') return typeLabel(n.type)
            if (col.key === 'title') return titleLabel(n)
            if (col.key === 'message') return messageLabel(n)
            if (col.key === 'status') return <StatusBadge value={n.is_read ? t('notifications.read') : t('notifications.unread')} toneValue={n.is_read ? 'read' : 'unread'} />
            if (col.key === 'date') return n.created_at?.slice(0, 10)
            if (col.key === 'actions') {
              return (
                <>
                  {!n.is_read ? (
                    <button type="button" className={styles.btnSm} onClick={() => markRead(n.id)}>
                      {t('notifications.markRead')}
                    </button>
                  ) : null}{' '}
                  <button type="button" className={styles.btnSm} onClick={() => openEntity(n)}>
                    {t('notifications.open')}
                  </button>
                </>
              )
            }
            return null
          }}
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
          bulkActions={
            <>
              <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={!sortedRows.length}>
                {t('common.exportExcel')}
              </button>
              <button type="button" className={styles.btnSm} onClick={markAllRead} disabled={loading}>
                {t('notifications.markAllRead')}
              </button>
            </>
          }
        />
      </ListPageDataPanel>
    </div>
  )
}
