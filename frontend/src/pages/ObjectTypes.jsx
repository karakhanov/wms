import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import ListPageDataPanel from '../components/ListPageDataPanel'
import EmptyState from '../components/EmptyState'
import { formatNumberCell } from '../utils/numberFormat'
import { ToolbarSearchInput } from '../components/ToolbarControls'
import panelStyles from './DataPanelLayout.module.css'
import styles from './Table.module.css'
import oStyles from './ObjectTypes.module.css'

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ObjectTypes() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = canManageWarehouse(user)

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    constructionApi
      .objectTypes({ page_size: 500, ordering: 'name' })
      .then((d) => setRows(d.results || d || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [r.name, r.code, r.description].join(' ').toLowerCase().includes(q))
  }, [rows, search])

  const listEmptyHint = useMemo(() => {
    if (filtered.length > 0) return ''
    if (search.trim()) return t('common.emptyStateFiltered')
    if (rows.length === 0 && canManage) return t('common.emptyStateHintWithAdd', { addLabel: t('common.add') })
    if (rows.length === 0) return t('common.emptyStateHintList')
    return t('common.emptyStateFiltered')
  }, [filtered.length, search, rows.length, canManage, t])

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title="Типы объектов и лимиты"
        leadExtra={canManage ? (
          <button type="button" className={styles.btnAdd} onClick={() => navigate('/object-types/new')}>
            {t('common.add')}
          </button>
        ) : null}
        loading={loading}
        search={(
          <ToolbarSearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.searchPlaceholder')}
          />
        )}
        filters={null}
      >
        <div className={`${styles.listTableShell} ${panelStyles.dataPanelTableWrap}`}>
          {filtered.length === 0 ? (
            <EmptyState
              hint={listEmptyHint}
              compact
              actionLabel={canManage ? t('common.add') : undefined}
              onAction={canManage ? () => navigate('/object-types/new') : undefined}
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Название</th>
                    <th>Фото</th>
                    <th>Код</th>
                    <th>Лимит суммы</th>
                    <th>Лимиты позиций</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={r.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <button type="button" className={oStyles.objectNameBtn} onClick={() => navigate(`/object-types/${r.id}`)}>
                          {r.name}
                        </button>
                      </td>
                      <td>
                        {photoUrl(r.photo_url || r.photo) ? (
                          <span className={oStyles.typePhotoFrame} onClick={() => navigate(`/object-types/${r.id}`)}>
                            <img src={photoUrl(r.photo_url || r.photo)} alt="" className={oStyles.typePhoto} />
                          </span>
                        ) : t('common.none')}
                      </td>
                      <td>{r.code || t('common.none')}</td>
                      <td>{formatNumberCell(r.limit_amount, 2) || t('common.none')}</td>
                      <td>{(r.item_limits || []).filter((x) => x.product || x.service).length}</td>
                      <td className={`${styles.actions} ${oStyles.actionsRow}`}>
                        {canManage ? (
                          <>
                            <button type="button" className={styles.btnSm} onClick={() => navigate(`/object-types/${r.id}/edit`)}>{t('common.edit')}</button>
                            <button type="button" className={styles.btnSm} onClick={() => navigate(`/object-types/${r.id}?tab=all`)}>Лимиты</button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ListPageDataPanel>
    </div>
  )
}

