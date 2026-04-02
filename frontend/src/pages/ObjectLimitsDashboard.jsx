import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../components/Modal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import panelStyles from './DataPanelLayout.module.css'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import { ToolbarSearchInput } from '../components/ToolbarControls'
import dashStyles from './ObjectLimitsDashboard.module.css'
import { formatQuantity } from '../utils/formatQuantity'
import api from '../api'

export default function ObjectLimitsDashboard() {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get('/reports/object-limits/')
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const openDetails = async (row) => {
    setSelected(row)
    setDetailsLoading(true)
    try {
      const r = await api.get(`/reports/object-limits/${row.object_id}/`)
      setDetails(Array.isArray(r.data) ? r.data : [])
    } catch {
      setDetails([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.object_name, r.object_type_name].join(' ').toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <div className={styles.page}>
      <Modal open={Boolean(selected)} title={selected ? `Лимиты: ${selected.object_name}` : ''} onClose={() => setSelected(null)}>
        {detailsLoading ? (
          <div>{t('common.loading')}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Позиция</th>
                  <th>Лимит</th>
                  <th>Использовано</th>
                  <th>Остаток</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {details.map((x, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{x.label}</td>
                    <td>{formatQuantity(x.limit_quantity)}</td>
                    <td>{formatQuantity(x.consumed_quantity)}</td>
                    <td>{formatQuantity(x.remaining_quantity)}</td>
                    <td style={{ color: x.is_exceeded ? 'crimson' : undefined }}>{x.utilization_percent}%</td>
                  </tr>
                ))}
                {!details.length && (
                  <tr><td colSpan={6} className={styles.emptyTableMsg}>Нет лимитов</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ListPageDataPanel
        flushTop
        title={t('nav.objectLimits')}
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
        <div className={dashStyles.cardsGrid}>
          {filtered.map((r) => (
            <div key={r.object_id} className={`${styles.tableWrap} ${dashStyles.card}`}>
              <div className={dashStyles.cardTitle}>{r.object_name}</div>
              <div className={dashStyles.cardMeta}>{r.object_type_name || '—'}</div>
              <div className={dashStyles.line}>Лимитов: <b>{r.limits_total}</b></div>
              <div className={dashStyles.line}>
                Превышено:{' '}
                <b className={r.limits_exceeded > 0 ? dashStyles.danger : ''}>{r.limits_exceeded}</b>
              </div>
              <div className={`${dashStyles.line} ${dashStyles.lineStrong}`}>Макс. загрузка: <b>{r.max_utilization_percent}%</b></div>
              <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={() => openDetails(r)}>
                Подробнее
              </button>
            </div>
          ))}
        </div>
      </ListPageDataPanel>
    </div>
  )
}
