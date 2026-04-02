import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api, { construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canManageConstructionObjects } from '../permissions'
import { IconBuilding, IconChevronLeft } from '../ui/Icons'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import panelStyles from './DataPanelLayout.module.css'
import pageStyles from './ProductDetailsPage.module.css'
import viewStyles from './ObjectEntityDetails.module.css'
import detailStyles from './ConstructionObjectDetails.module.css'
import { formatNumberCell } from '../utils/numberFormat'

function splitLimitLabel(label) {
  if (!label || typeof label !== 'string') return { code: null, name: '—' }
  const idx = label.indexOf(' - ')
  if (idx === -1) return { code: null, name: label }
  return { code: label.slice(0, idx).trim(), name: label.slice(idx + 3).trim() }
}

function utilizationBarClass(p) {
  if (p >= 85) return detailStyles.utilBarRed
  if (p >= 60) return detailStyles.utilBarYellow
  return detailStyles.utilBarGreen
}

function UtilizationCell({ percent }) {
  const p = Number(percent) || 0
  const w = Math.min(Math.max(p, 0), 100)
  return (
    <td className={detailStyles.utilCell}>
      <div className={detailStyles.utilBarTrack}>
        <div
          className={`${detailStyles.utilBarFill} ${utilizationBarClass(p)}`}
          style={{ width: `${w}%` }}
          role="progressbar"
          aria-valuenow={Math.round(p)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className={detailStyles.utilPercent}>{formatNumberCell(p, 2) ?? '0'}%</span>
    </td>
  )
}

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ConstructionObjectDetails() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManageLimits = canManageConstructionObjects(user)
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [objectTypes, setObjectTypes] = useState([])
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    object_type: '',
    photo: null,
    remove_photo: false,
  })
  const photoInputRef = useRef(null)
  const photoUploadPublicRef = useRef(null)
  const [limitsLoading, setLimitsLoading] = useState(false)
  const [limitsRows, setLimitsRows] = useState([])
  const [typeLimitsLoading, setTypeLimitsLoading] = useState(false)
  const [typeLimitsRows, setTypeLimitsRows] = useState([])
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const tab = searchParams.get('tab') || 'limits'
  const limitsView = searchParams.get('limits_view') || 'object'

  useEffect(() => {
    setLoading(true)
    constructionApi
      .objectGet(id)
      .then((data) => {
        setRow(data)
        setForm({
          name: data?.name || '',
          code: data?.code || '',
          address: data?.address || '',
          object_type: data?.object_type ? String(data.object_type) : '',
          photo: null,
          remove_photo: false,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!isEditing) return
    constructionApi
      .objectTypes({ page_size: 500, ordering: 'name' })
      .then((d) => setObjectTypes(d.results || d || []))
      .catch(() => setObjectTypes([]))
  }, [isEditing])

  useEffect(() => {
    if (!id) return
    setLimitsLoading(true)
    api
      .get(`/reports/object-limits/${id}/`)
      .then((r) => setLimitsRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLimitsRows([]))
      .finally(() => setLimitsLoading(false))
  }, [id])

  useEffect(() => {
    const typeId = row?.object_type
    if (!typeId) {
      setTypeLimitsRows([])
      return
    }
    setTypeLimitsLoading(true)
    constructionApi
      .objectTypeGet(typeId)
      .then((data) => {
        const rows = Array.isArray(data?.item_limits) ? data.item_limits : []
        setTypeLimitsRows(rows)
      })
      .catch(() => setTypeLimitsRows([]))
      .finally(() => setTypeLimitsLoading(false))
  }, [row?.object_type])

  const setTab = (nextTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next)
  }

  const setLimitsView = (nextView) => {
    const next = new URLSearchParams(searchParams)
    next.set('limits_view', nextView)
    setSearchParams(next)
  }

  const overviewEntries = useMemo(
    () => [
      {
        key: 'code',
        label: t('objectDetails.fieldCode'),
        value: row?.code?.trim() ? row.code : null,
      },
      {
        key: 'type',
        label: t('objectDetails.fieldType'),
        value: row?.object_type_name?.trim() ? row.object_type_name : null,
      },
      {
        key: 'address',
        label: t('objectDetails.fieldAddress'),
        value: row?.address?.trim() ? row.address : null,
      },
    ],
    [row, t]
  )

  const filteredLimitRows = useMemo(() => {
    if (!limitsRows.length) return []
    return limitsRows
      .filter((x) => (tab === 'products' ? x.kind !== 'service' : tab === 'services' ? x.kind === 'service' : true))
      .sort((a, b) =>
        tab === 'utilization' ? Number(b.utilization_percent || 0) - Number(a.utilization_percent || 0) : 0
      )
  }, [limitsRows, tab])

  const filteredTypeLimitRows = useMemo(() => {
    if (!typeLimitsRows.length) return []
    if (tab === 'products') return typeLimitsRows.filter((x) => x.product)
    if (tab === 'services') return typeLimitsRows.filter((x) => x.service)
    return typeLimitsRows
  }, [typeLimitsRows, tab])

  const addLimitHref = row?.object_type ? `/object-types/${row.object_type}/edit#object-type-item-limits` : null

  const startEdit = () => {
    setError('')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setError('')
    setIsEditing(false)
    setForm({
      name: row?.name || '',
      code: row?.code || '',
      address: row?.address || '',
      object_type: row?.object_type ? String(row.object_type) : '',
      photo: null,
      remove_photo: false,
    })
  }

  const saveEdit = async () => {
    if (!form.name.trim()) {
      setError('Введите название объекта.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim(),
        object_type: form.object_type ? Number(form.object_type) : null,
      }
      if (form.remove_photo && !form.photo) payload.photo = null
      const updated = await constructionApi.updateObject(id, payload)
      if (form.photo) {
        await constructionApi.uploadObjectPhoto(id, form.photo)
      }
      const fresh = updated?.id ? await constructionApi.objectGet(id) : updated
      setRow(fresh || updated)
      setIsEditing(false)
      setForm((prev) => ({ ...prev, photo: null, remove_photo: false }))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось сохранить объект.')
    } finally {
      setSaving(false)
    }
  }

  const onPhotoChange = async (file) => {
    if (!file || !row?.id) return
    setPhotoBusy(true)
    setError('')
    try {
      await constructionApi.uploadObjectPhoto(row.id, file)
      const fresh = await constructionApi.objectGet(id)
      setRow(fresh)
      setForm((prev) => ({ ...prev, photo: null, remove_photo: false }))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось обновить фото.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const onPhotoDelete = async () => {
    if (!row?.id) return
    setPhotoBusy(true)
    setError('')
    try {
      await constructionApi.updateObject(row.id, { photo: null })
      const fresh = await constructionApi.objectGet(id)
      setRow(fresh)
      setPhotoViewerOpen(false)
      setForm((prev) => ({ ...prev, photo: null, remove_photo: false }))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось удалить фото.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const tabHeadline =
    tab === 'overview'
      ? t('objectDetails.tabOverview')
      : tab === 'limits'
        ? t('objectDetails.tabLimits')
        : tab === 'products'
          ? t('objectDetails.tabProducts')
          : tab === 'services'
            ? t('objectDetails.tabServices')
            : t('objectDetails.tabUtilization')

  const renderOverviewValue = (v) =>
    v != null && v !== '' ? <span>{v}</span> : <span className={detailStyles.emptyValue}>{t('objectDetails.notSet')}</span>

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <Link to="/objects" className={detailStyles.backIconBtn} title={t('objectDetails.backToObjects')} aria-label={t('objectDetails.backToObjects')}>
          <IconChevronLeft size={20} />
        </Link>
      </div>
      {loading ? <div className={styles.stateCard}>{t('common.loading')}</div> : (
        <>
          <section className={pageStyles.unifiedCard}>
            <div className={viewStyles.heroInUnified}>
              <section className={pageStyles.panelCard}>
                <div className={pageStyles.panelTitle}>Фото</div>
                <div className={pageStyles.panelBody}>
                  <div className={viewStyles.photoMedia}>
                    {!form.remove_photo && photoUrl(row?.photo_url || row?.photo) ? (
                      <img
                        src={photoUrl(row.photo_url || row.photo)}
                        alt=""
                        className={viewStyles.heroPhoto}
                        style={{ cursor: 'zoom-in' }}
                        onClick={() => setPhotoViewerOpen(true)}
                      />
                    ) : (
                      <div className={detailStyles.photoPlaceholderBox}>
                        <IconBuilding className={detailStyles.photoPlaceholderIcon} size={72} aria-hidden />
                        <input
                          ref={photoUploadPublicRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) onPhotoChange(f)
                            e.target.value = ''
                          }}
                        />
                        <button
                          type="button"
                          className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                          disabled={photoBusy}
                          onClick={() => photoUploadPublicRef.current?.click()}
                        >
                          {t('objectDetails.uploadPhoto')}
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className={viewStyles.photoActions}>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => setForm((p) => ({ ...p, photo: e.target.files?.[0] || null, remove_photo: false }))}
                      />
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                        onClick={() => photoInputRef.current?.click()}
                      >
                        Изменить фото
                      </button>
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                        onClick={() => setForm((p) => ({ ...p, photo: null, remove_photo: true }))}
                      >
                        Удалить фото
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
              <section className={pageStyles.panelCard}>
                <div className={`${pageStyles.panelTitle} ${viewStyles.objectPanelHead}`}>
                  <span className={viewStyles.objectPanelHeadTitle}>{row?.name || 'Объект'}</span>
                  <div>
                    {isEditing ? (
                      <div className={viewStyles.actions} style={{ marginTop: 0 }}>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={saveEdit} disabled={saving}>
                          {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={cancelEdit} disabled={saving}>
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={startEdit}>
                        Изменить
                      </button>
                    )}
                  </div>
                </div>
                <div className={pageStyles.panelBody}>
                  {isEditing ? (
                    <div className={viewStyles.editGrid}>
                      <div className={viewStyles.editField}>
                        <label className={viewStyles.editLabel}>Название</label>
                        <input className={formStyles.input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className={viewStyles.editField}>
                        <label className={viewStyles.editLabel}>Код</label>
                        <input className={formStyles.input} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
                      </div>
                      <div className={viewStyles.editField}>
                        <label className={viewStyles.editLabel}>Тип</label>
                        <select className={formStyles.input} value={form.object_type} onChange={(e) => setForm((p) => ({ ...p, object_type: e.target.value }))}>
                          <option value="">—</option>
                          {objectTypes.map((x) => (
                            <option key={x.id} value={String(x.id)}>{x.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className={viewStyles.editField}>
                        <label className={viewStyles.editLabel}>Адрес</label>
                        <input className={formStyles.input} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                      </div>
                      <div className={viewStyles.editField} style={{ gridColumn: '1 / -1' }}>
                        {error ? <div className={formStyles.error}>{error}</div> : null}
                      </div>
                    </div>
                  ) : (
                    <div className={`${pageStyles.infoGrid} ${viewStyles.infoGridObject}`}>
                      {overviewEntries.map(({ key, label, value }) => (
                        <div key={key} className={pageStyles.row}>
                          <span className={pageStyles.k}>{label}</span>
                          {renderOverviewValue(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>

          <div className={panelStyles.dataPanelSection}>
            <div className={detailStyles.objectTabsBar} role="tablist" aria-label={t('objectDetails.tabsAria')}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'overview'}
                className={`${detailStyles.objectTab} ${tab === 'overview' ? detailStyles.objectTabActive : ''}`}
                onClick={() => setTab('overview')}
              >
                {t('objectDetails.tabOverview')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'limits'}
                className={`${detailStyles.objectTab} ${tab === 'limits' ? detailStyles.objectTabActive : ''}`}
                onClick={() => setTab('limits')}
              >
                {t('objectDetails.tabLimits')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'products'}
                className={`${detailStyles.objectTab} ${tab === 'products' ? detailStyles.objectTabActive : ''}`}
                onClick={() => setTab('products')}
              >
                {t('objectDetails.tabProducts')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'services'}
                className={`${detailStyles.objectTab} ${tab === 'services' ? detailStyles.objectTabActive : ''}`}
                onClick={() => setTab('services')}
              >
                {t('objectDetails.tabServices')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'utilization'}
                className={`${detailStyles.objectTab} ${tab === 'utilization' ? detailStyles.objectTabActive : ''}`}
                onClick={() => setTab('utilization')}
              >
                {t('objectDetails.tabUtilization')}
              </button>
            </div>

            <div className={panelStyles.dataPanelCard}>
              <div className={panelStyles.dataPanelToolbar}>
                <div className={panelStyles.filterToolbar}>
                  <div className={panelStyles.filterToolbarLead}>
                    <div className={panelStyles.filterToolbarHeadline}>{tabHeadline}</div>
                  </div>
                  {tab !== 'overview' && canManageLimits ? (
                    <div className={panelStyles.filterToolbarActions}>
                      <button
                        type="button"
                        className={`${formStyles.btn} ${limitsView === 'object' ? formStyles.btnPrimary : formStyles.btnSecondary}`}
                        onClick={() => setLimitsView('object')}
                      >
                        Лимиты объекта
                      </button>
                      <button
                        type="button"
                        className={`${formStyles.btn} ${limitsView === 'type' ? formStyles.btnPrimary : formStyles.btnSecondary}`}
                        onClick={() => setLimitsView('type')}
                      >
                        Лимиты типа
                      </button>
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                        disabled={!addLimitHref}
                        title={!addLimitHref ? t('objectDetails.addLimitNeedType') : undefined}
                        onClick={() => addLimitHref && navigate(addLimitHref)}
                      >
                        Редактировать лимиты типа
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={panelStyles.dataPanelDivider} aria-hidden />
              <div className={panelStyles.dataPanelBody}>
                {limitsLoading && tab !== 'overview' && limitsView === 'object' ? (
                  <div className={panelStyles.dataPanelBlockLoading}>{t('common.loading')}</div>
                ) : typeLimitsLoading && tab !== 'overview' && limitsView === 'type' ? (
                  <div className={panelStyles.dataPanelBlockLoading}>{t('common.loading')}</div>
                ) : tab === 'overview' ? (
                  <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                    <table className={styles.table}>
                      <tbody>
                        {overviewEntries.map(({ key, label, value }) => (
                          <tr key={key}>
                            <th>{label}</th>
                            <td>{renderOverviewValue(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : limitsView === 'type' && !filteredTypeLimitRows.length ? (
                  <div className={detailStyles.limitsEmpty}>
                    <IconBuilding size={48} className={detailStyles.limitsEmptyIcon} aria-hidden />
                    <p className={detailStyles.limitsEmptyTitle}>Для типа объекта лимиты не заданы</p>
                    <p className={detailStyles.limitsEmptyHint}>Добавьте лимиты в карточке типа объекта</p>
                    {canManageLimits ? (
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                        disabled={!addLimitHref}
                        title={!addLimitHref ? t('objectDetails.addLimitNeedType') : undefined}
                        onClick={() => addLimitHref && navigate(addLimitHref)}
                      >
                        Редактировать лимиты типа
                      </button>
                    ) : null}
                  </div>
                ) : limitsView === 'object' && !limitsRows.length ? (
                  <div className={detailStyles.limitsEmpty}>
                    <IconBuilding size={48} className={detailStyles.limitsEmptyIcon} aria-hidden />
                    <p className={detailStyles.limitsEmptyTitle}>{t('objectDetails.limitsEmptyTitle')}</p>
                    <p className={detailStyles.limitsEmptyHint}>{t('objectDetails.limitsEmptyHint')}</p>
                    {canManageLimits ? (
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                        disabled={!addLimitHref}
                        title={!addLimitHref ? t('objectDetails.addLimitNeedType') : undefined}
                        onClick={() => addLimitHref && navigate(addLimitHref)}
                      >
                        Редактировать лимиты типа
                      </button>
                    ) : null}
                  </div>
                ) : limitsView === 'object' && !filteredLimitRows.length ? (
                  <div className={detailStyles.filteredEmpty}>{t('objectDetails.limitsFilteredEmpty')}</div>
                ) : (
                  <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>{t('objectDetails.colKind')}</th>
                          <th>{t('objectDetails.colPosition')}</th>
                          <th>{t('objectDetails.colLimit')}</th>
                          {limitsView === 'object' ? <th>{t('objectDetails.colUsed')}</th> : null}
                          {limitsView === 'object' ? <th>{t('objectDetails.colRemaining')}</th> : null}
                          {limitsView === 'object' ? <th>{t('objectDetails.colPercent')}</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(limitsView === 'type' ? filteredTypeLimitRows : filteredLimitRows).map((x, idx) => {
                          const sourceLabel =
                            limitsView === 'type'
                              ? (x.product ? `${x.product_sku || ''} - ${x.product_name || ''}` : `${x.service_code || ''} - ${x.service_name || ''}`)
                              : x.label
                          const { code, name } = splitLimitLabel(sourceLabel)
                          return (
                            <tr key={`${x.kind || (x.service ? 'service' : 'product')}-${sourceLabel}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td>{x.service ? t('objectDetails.kindService') : x.kind === 'service' ? t('objectDetails.kindService') : t('objectDetails.kindProduct')}</td>
                              <td>
                                <span className={detailStyles.limitPositionName}>{name}</span>
                                {code ? <span className={detailStyles.limitPositionCode}>{code}</span> : null}
                              </td>
                              <td>{formatNumberCell(x.limit_quantity, 3) ? <span>{formatNumberCell(x.limit_quantity, 3)}</span> : renderOverviewValue(null)}</td>
                              {limitsView === 'object' ? <td>{formatNumberCell(x.consumed_quantity, 3) ? <span>{formatNumberCell(x.consumed_quantity, 3)}</span> : renderOverviewValue(null)}</td> : null}
                              {limitsView === 'object' ? <td>{formatNumberCell(x.remaining_quantity, 3) ? <span>{formatNumberCell(x.remaining_quantity, 3)}</span> : renderOverviewValue(null)}</td> : null}
                              {limitsView === 'object' ? <UtilizationCell percent={x.utilization_percent} /> : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {photoViewerOpen ? (
            <div className={viewStyles.photoOverlay} onClick={() => !photoBusy && setPhotoViewerOpen(false)}>
              <div className={viewStyles.photoDialog} onClick={(e) => e.stopPropagation()}>
                {photoUrl(row?.photo_url || row?.photo) ? (
                  <img src={photoUrl(row.photo_url || row.photo)} alt="" className={viewStyles.photoDialogImg} />
                ) : (
                  <div className={viewStyles.photoDialogEmpty}>
                    <IconBuilding size={56} className={detailStyles.photoPlaceholderIcon} aria-hidden />
                    <p style={{ margin: '12px 0 0', color: 'var(--muted)' }}>{t('objectDetails.noPhotoYet')}</p>
                    <label className={`${formStyles.btn} ${formStyles.btnSecondary}`} style={{ marginTop: 14 }}>
                      {t('objectDetails.uploadPhoto')}
                      <input type="file" hidden accept="image/*" disabled={photoBusy} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
                    </label>
                  </div>
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
        </>
      )}
    </div>
  )
}

