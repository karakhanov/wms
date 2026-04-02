import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import ListPageDataPanel from '../components/ListPageDataPanel'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import EmptyState from '../components/EmptyState'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { formatNumberCell } from '../utils/numberFormat'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { ToolbarSearchInput } from '../components/ToolbarControls'
import panelStyles from './DataPanelLayout.module.css'
import tableStyles from './Table.module.css'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './ConstructionObjects.module.css'

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ConstructionObjects() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = canManageWarehouse(user)
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const debouncedSearch = useDebouncedValue(search, 300)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const ordering = `${sortDir === 'desc' ? '-' : ''}${sortKey}`
    constructionApi
      .objects({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        ordering,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [debouncedSearch, page, pageSize, sortKey, sortDir])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const toggleSort = (key) => {
    setPage(1)
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const rows = tableData.results || []
  const count = tableData.count ?? rows.length
  const pages = totalPages(count, pageSize)
  const listEmptyHint = useMemo(() => {
    if (rows.length > 0) return ''
    if (debouncedSearch.trim()) return t('common.emptyStateFiltered')
    if (canManage) return t('common.emptyStateHintWithAdd', { addLabel: t('common.add') })
    return t('common.emptyStateHintList')
  }, [rows.length, debouncedSearch, canManage, t])

  const requestDelete = (id, name) => setDeleteTarget({ id, name })

  const exportCsv = async () => {
    try {
      const ordering = `${sortDir === 'desc' ? '-' : ''}${sortKey}`
      const d = await constructionApi.objects({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        ordering,
      })
      const all = normalizeListResponse(d).results || []
      downloadCsv(
        `construction-objects-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('objects.id'), t('objects.name'), t('objects.code'), t('objects.address')],
        all.map((r) => [r.id, r.name, r.code || '', r.address || ''])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={tableStyles.page}>
      {canManage && (
        <ConfirmDeleteModal
          open={!!deleteTarget}
          itemName={deleteTarget?.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return Promise.resolve()
            return constructionApi.deleteObject(deleteTarget.id).then(() => load())
          }}
        />
      )}
      <ListPageDataPanel
        flushTop
        title={t('objects.title')}
        leadExtra={canManage ? (
          <button type="button" className={tableStyles.btnAdd} onClick={() => navigate('/objects/new')}>
            {t('common.add')}
          </button>
        ) : null}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading || !rows.length}>
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
        filters={null}
      >
        <div className={`${tableStyles.listTableShell} ${panelStyles.dataPanelTableWrap}`}>
          {rows.length === 0 ? (
            <EmptyState
              hint={listEmptyHint}
              compact
              actionLabel={canManage ? t('common.add') : undefined}
              onAction={canManage ? () => navigate('/objects/new') : undefined}
            />
          ) : (
            <>
              <div className={tableStyles.tableWrap}>
                <table className={`${tableStyles.table} ${styles.objectsTable}`}>
                  <thead>
                    <tr>
                      <SortHeader className={`${tableStyles.sortableHeader} ${styles.headStrong} ${styles.colNo}`} label={t('objects.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                      <th className={`${styles.headStrong} ${styles.colPhoto}`}>Фото</th>
                      <SortHeader className={`${tableStyles.sortableHeader} ${styles.headStrong} ${styles.colObject}`} label={t('objects.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                      <SortHeader className={`${tableStyles.sortableHeader} ${styles.headStrong} ${styles.colCode}`} label={t('objects.code')} sortKey="code" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                      <th className={`${styles.headStrong} ${styles.colType}`}>Тип</th>
                      <th className={`${styles.headStrong} ${styles.colAmount}`}>Лимит суммы</th>
                      <SortHeader className={`${tableStyles.sortableHeader} ${styles.headStrong} ${styles.colAddress}`} label={t('objects.address')} sortKey="address" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                      <th className={styles.colActions} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={styles.rowPremium}>
                        <td className={styles.noCell}>{r.id}</td>
                        <td>
                          {photoUrl(r.photo_url || r.photo) ? (
                            <span className={styles.thumbFrame} onClick={() => navigate(`/objects/${r.id}`)}>
                              <img src={photoUrl(r.photo_url || r.photo)} alt="" className={styles.thumbFancy} />
                            </span>
                          ) : t('common.none')}
                        </td>
                        <td>
                          <button type="button" className={styles.objectChip} onClick={() => navigate(`/objects/${r.id}`)}>
                            {r.name}
                          </button>
                        </td>
                        <td>{r.code || t('common.none')}</td>
                        <td>{r.object_type_name || t('common.none')}</td>
                        <td className={styles.amountCell}>{formatNumberCell(r.limit_amount_override, 2) || t('common.none')}</td>
                        <td>{r.address || t('common.none')}</td>
                        <td className={tableStyles.actions}>
                          <div className={styles.rowActions}>
                            <button type="button" className={`${tableStyles.btnSm} ${styles.iconBtn}`} onClick={() => navigate(`/objects/${r.id}?tab=limits`)}>
                              <span aria-hidden="true" className={styles.dot} />
                              Лимиты
                            </button>
                            {canManage ? (
                              <>
                                <button type="button" className={`${tableStyles.btnSm} ${styles.iconBtn}`} onClick={() => navigate(`/objects/${r.id}/edit`)}>
                                  <span aria-hidden="true" className={styles.dot} />
                                  {t('common.edit')}
                                </button>
                                <button
                                  type="button"
                                  className={`${tableStyles.btnSm} ${tableStyles.btnDanger} ${styles.iconBtn}`}
                                  onClick={() => requestDelete(r.id, r.name)}
                                >
                                  <span aria-hidden="true" className={styles.dot} />
                                  {t('common.delete')}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={tableStyles.paginationDock}>
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
            </>
          )}
        </div>
      </ListPageDataPanel>
    </div>
  )
}

