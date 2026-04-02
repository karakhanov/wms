import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import pageStyles from './ProductDetailsPage.module.css'

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ConstructionObjectEditor() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = canManageWarehouse(user)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [types, setTypes] = useState([])
  const [existingPhoto, setExistingPhoto] = useState('')
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    object_type: '',
    photo: null,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const typesRes = await constructionApi.objectTypes({ page_size: 500, is_active: true, ordering: 'name' })
      setTypes(typesRes.results || typesRes || [])
      if (isEdit) {
        const row = await constructionApi.objectGet(id)
        setForm({
          name: row.name || '',
          code: row.code || '',
          address: row.address || '',
          object_type: row.object_type ? String(row.object_type) : '',
          photo: null,
        })
        setExistingPhoto(photoUrl(row.photo_url || row.photo))
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [id, isEdit])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!canManage) return
    setError('')
    if (!form.name.trim()) {
      setError('Укажите название объекта')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim(),
        object_type: form.object_type ? Number(form.object_type) : null,
      }
      let saved
      if (isEdit) saved = await constructionApi.updateObject(id, payload)
      else saved = await constructionApi.createObject(payload)
      if (form.photo) {
        const targetId = isEdit ? id : saved?.id
        if (targetId) await constructionApi.uploadObjectPhoto(targetId, form.photo)
        window.alert('Фото успешно сохранено.')
      }
      navigate('/objects')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось сохранить объект')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>{isEdit ? 'Редактировать объект' : 'Создать объект'}</h1>
        <Link to="/objects" className={`${formStyles.btn} ${formStyles.btnSecondary}`}>← Назад</Link>
      </div>
      {loading ? <div>{t('common.loading')}</div> : (
        <div className={styles.pageBody}>
          <form onSubmit={submit} className={formStyles.form} style={{ maxWidth: '100%' }}>
            <section className={pageStyles.unifiedCard}>
              <div className={pageStyles.topSummary}>
                <span className={pageStyles.summaryThumbBtn} aria-hidden>
                  <span className={pageStyles.summaryThumbPlaceholder} />
                </span>
                <div className={pageStyles.summaryMeta}>
                  <h2 className={pageStyles.summaryTitle}>{isEdit ? 'Редактировать объект' : 'Создать объект'}</h2>
                </div>
              </div>
              <div className={pageStyles.twoCol}>
                <section className={pageStyles.panelCard}>
                  <h3 className={pageStyles.panelTitle}>Основные поля</h3>
                  <div className={pageStyles.panelBody}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <div className={formStyles.row}><label>Название</label><input className={formStyles.input} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></div>
                      <div className={formStyles.row}><label>Код</label><input className={formStyles.input} value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} /></div>
                      <div className={formStyles.row}><label>Адрес</label><input className={formStyles.input} value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} /></div>
                      <div className={formStyles.row}>
                        <label>Тип объекта</label>
                        <select className={formStyles.select} value={form.object_type} onChange={(e) => setForm((v) => ({ ...v, object_type: e.target.value }))}>
                          <option value="">—</option>
                          {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={formStyles.photoWrap}>
                      {existingPhoto && !form.photo ? (
                        <img src={existingPhoto} alt="" className={formStyles.photoPreview} />
                      ) : (
                        <div className={formStyles.photoPlaceholder}>Фото</div>
                      )}
                      <div className={formStyles.row} style={{ flex: 1 }}>
                        <label>Фото</label>
                        <input type="file" accept="image/*" className={formStyles.input} onChange={(e) => setForm((v) => ({ ...v, photo: e.target.files?.[0] || null }))} />
                      </div>
                    </div>
                  </div>
                </section>
                <section className={pageStyles.panelCard}>
                  <h3 className={pageStyles.panelTitle}>Лимиты</h3>
                  <div className={pageStyles.panelBody}>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                      Лимиты по позициям задаются в типе объекта. После сохранения объекта откройте тип объекта и отредактируйте лимиты там.
                    </p>
                  </div>
                </section>
              </div>
              {error ? <div className={formStyles.error}>{error}</div> : null}
              <div className={formStyles.actions}>
                <Link to="/objects" className={`${formStyles.btn} ${formStyles.btnSecondary}`}>{t('common.cancel')}</Link>
                <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`} disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </section>
          </form>
        </div>
      )}
    </div>
  )
}
