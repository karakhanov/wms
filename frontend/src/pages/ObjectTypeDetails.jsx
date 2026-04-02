import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { construction as constructionApi } from '../api'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import viewStyles from './ObjectEntityDetails.module.css'
import { formatNumberCell } from '../utils/numberFormat'

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ObjectTypeDetails() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const tab = searchParams.get('tab') || 'all'

  useEffect(() => {
    setLoading(true)
    constructionApi.objectTypeGet(id).then(setRow).finally(() => setLoading(false))
  }, [id])

  const limits = row?.item_limits || []
  const filteredLimits = useMemo(() => {
    if (tab === 'products') return limits.filter((x) => x.product)
    if (tab === 'services') return limits.filter((x) => x.service)
    return limits
  }, [limits, tab])

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    setSearchParams(next)
  }

  const onPhotoChange = async (file) => {
    if (!file || !row?.id) return
    setPhotoBusy(true)
    try {
      await constructionApi.uploadObjectTypePhoto(row.id, file)
      const fresh = await constructionApi.objectTypeGet(id)
      setRow(fresh)
    } finally {
      setPhotoBusy(false)
    }
  }

  const onPhotoDelete = async () => {
    if (!row?.id) return
    setPhotoBusy(true)
    try {
      await constructionApi.updateObjectType(row.id, { photo: null })
      const fresh = await constructionApi.objectTypeGet(id)
      setRow(fresh)
      setPhotoViewerOpen(false)
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <Link to="/object-types" className={viewStyles.backTextLink}>← Назад к типам объектов</Link>
          <div className={viewStyles.titleRow}>
            <h1 className={`${styles.h1} ${viewStyles.pageTitle}`}>{row?.name || 'Тип объекта'}</h1>
          </div>
        </div>
      </div>
      {loading ? <div className={styles.stateCard}>Загрузка...</div> : (
        <div className={styles.pageBody}>
          {/* 1й блок: Информация */}
          <div className={viewStyles.hero}>
            <div className={viewStyles.photoCard}>
              <div className={viewStyles.photoMedia}>
                {photoUrl(row?.photo_url || row?.photo) ? (
                  <img
                    src={photoUrl(row.photo_url || row.photo)}
                    alt=""
                    className={viewStyles.heroPhoto}
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setPhotoViewerOpen(true)}
                  />
                ) : (
                  <div className={viewStyles.photoPlaceholder} style={{ cursor: 'zoom-in' }} onClick={() => setPhotoViewerOpen(true)}>
                    Фото отсутствует
                  </div>
                )}
              </div>
            </div>
            <div className={viewStyles.infoCard}>
              <div className={viewStyles.actionsTop}>
                <Link to={`/object-types/${id}/edit`} className={`${formStyles.btn} ${formStyles.btnPrimary}`}>Изменить</Link>
              </div>
              <div className={viewStyles.infoGrid}>
                <div className={viewStyles.row}><span className={viewStyles.k}>Код</span><span>{row?.code || '—'}</span></div>
                <div className={viewStyles.row}><span className={viewStyles.k}>Лимит суммы</span><span>{formatNumberCell(row?.limit_amount, 2) || '—'}</span></div>
                <div className={viewStyles.row}><span className={viewStyles.k}>Описание</span><span>{row?.description || '—'}</span></div>
                <div className={viewStyles.row}><span className={viewStyles.k}>Лимитов позиций</span><span>{(row?.item_limits || []).length}</span></div>
              </div>
            </div>
          </div>

          {/* 2й блок: ТАБы */}
          <div className={viewStyles.tabsFive}>
            <button type="button" className={`${formStyles.btn} ${tab === 'all' ? formStyles.btnPrimary : formStyles.btnSecondary}`} onClick={() => setTab('all')}>
              Все лимиты
            </button>
            <button type="button" className={`${formStyles.btn} ${tab === 'products' ? formStyles.btnPrimary : formStyles.btnSecondary}`} onClick={() => setTab('products')}>
              Товары
            </button>
            <button type="button" className={`${formStyles.btn} ${tab === 'services' ? formStyles.btnPrimary : formStyles.btnSecondary}`} onClick={() => setTab('services')}>
              Услуги
            </button>
            <button type="button" className={`${formStyles.btn} ${tab === 'summary' ? formStyles.btnPrimary : formStyles.btnSecondary}`} onClick={() => setTab('summary')}>
              Сводка
            </button>
            <button type="button" className={`${formStyles.btn} ${tab === 'settings' ? formStyles.btnPrimary : formStyles.btnSecondary}`} onClick={() => setTab('settings')}>
              Параметры
            </button>
          </div>

          {/* 3й блок: Информация через табы */}
          <div className={`${styles.tableWrap} ${viewStyles.contentTopGap}`}>
            {tab === 'summary' ? (
              <table className={styles.table}>
                <tbody>
                  <tr><th>Название</th><td>{row?.name || '—'}</td></tr>
                  <tr><th>Код</th><td>{row?.code || '—'}</td></tr>
                  <tr><th>Лимит суммы</th><td>{formatNumberCell(row?.limit_amount, 2) || '—'}</td></tr>
                  <tr><th>Лимитов позиций</th><td>{(row?.item_limits || []).length}</td></tr>
                </tbody>
              </table>
            ) : tab === 'settings' ? (
              <table className={styles.table}>
                <tbody>
                  <tr><th>Описание</th><td>{row?.description || '—'}</td></tr>
                  <tr><th>Активные товары</th><td>{(limits || []).filter((x) => x.product).length}</td></tr>
                  <tr><th>Активные услуги</th><td>{(limits || []).filter((x) => x.service).length}</td></tr>
                </tbody>
              </table>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Тип позиции</th>
                    <th>Позиция</th>
                    <th>Лимит количества</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLimits.map((x, idx) => (
                    <tr key={x.id}>
                      <td>{idx + 1}</td>
                      <td>{x.product ? 'Товар' : 'Услуга'}</td>
                      <td>{x.product ? `${x.product_sku || ''} ${x.product_name || ''}`.trim() : `${x.service_code || ''} ${x.service_name || ''}`.trim()}</td>
                      <td>{formatNumberCell(x.limit_quantity, 3) || '—'}</td>
                    </tr>
                  ))}
                  {!filteredLimits.length ? (
                    <tr>
                      <td colSpan={4} className={styles.emptyTableMsg}>Нет данных</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>

          {photoViewerOpen ? (
            <div className={viewStyles.photoOverlay} onClick={() => !photoBusy && setPhotoViewerOpen(false)}>
              <div className={viewStyles.photoDialog} onClick={(e) => e.stopPropagation()}>
                {photoUrl(row?.photo_url || row?.photo) ? (
                  <img src={photoUrl(row.photo_url || row.photo)} alt="" className={viewStyles.photoDialogImg} />
                ) : (
                  <div className={viewStyles.photoDialogEmpty}>Фото отсутствует</div>
                )}
                <div className={viewStyles.photoDialogActions}>
                  <label className={`${formStyles.btn} ${formStyles.btnSecondary}`}>
                    Изменить фото
                    <input type="file" hidden accept="image/*" disabled={photoBusy} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
                  </label>
                  <button type="button" className={`${formStyles.btn} ${formStyles.btnDanger}`} disabled={photoBusy} onClick={onPhotoDelete}>
                    Удалить фото
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

