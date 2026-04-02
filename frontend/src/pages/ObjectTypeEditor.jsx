import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { construction as constructionApi, products as productsApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import { formatNumberInput, numberInputToApi, sanitizeNumberInput } from '../utils/numberFormat'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

function photoUrl(v) {
  if (!v) return ''
  const s = String(v)
  if (s.startsWith('http')) return s
  return `/${s}`.replace(/^\/+/, '/')
}

export default function ObjectTypeEditor() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = canManageWarehouse(user)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingPhoto, setExistingPhoto] = useState('')

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [form, setForm] = useState({ name: '', code: '', description: '', limit_amount: '', photo: null })
  const [limits, setLimits] = useState([{ kind: 'product', category: '', product: '', service: '', limit_quantity: '' }])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [productsRes, categoriesRes, servicesRes] = await Promise.all([
        productsApi.list({ page_size: 1000, is_active: true, ordering: 'name' }),
        productsApi.categories({ page_size: 500, ordering: 'name' }),
        productsApi.services({ page_size: 1000, is_active: true, ordering: 'name' }),
      ])
      const productsRows = productsRes.results || productsRes || []
      setProducts(productsRows)
      setCategories(categoriesRes.results || categoriesRes || [])
      setServices(servicesRes.results || servicesRes || [])

      if (isEdit) {
        const typeRes = await constructionApi.objectTypeGet(id)
        setForm({
          name: typeRes.name || '',
          code: typeRes.code || '',
          description: typeRes.description || '',
          limit_amount: typeRes.limit_amount ?? '',
          photo: null,
        })
        setExistingPhoto(photoUrl(typeRes.photo_url || typeRes.photo))
        const next = (typeRes.item_limits || [])
          .filter((x) => x.product || x.service)
          .map((x) => {
            if (x.product) {
              const product = productsRows.find((p) => Number(p.id) === Number(x.product))
              return {
                kind: 'product',
                category: product?.category ? String(product.category) : '',
                product: String(x.product),
                service: '',
                limit_quantity: String(x.limit_quantity ?? ''),
              }
            }
            return {
              kind: 'service',
              category: '',
              product: '',
              service: String(x.service),
              limit_quantity: String(x.limit_quantity ?? ''),
            }
          })
        setLimits(next.length ? next : [{ kind: 'product', category: '', product: '', service: '', limit_quantity: '' }])
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

  useEffect(() => {
    if (loading) return
    if (window.location.hash !== '#object-type-item-limits') return
    const timer = window.setTimeout(() => {
      document.getElementById('object-type-item-limits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [loading])

  const updateLimitRow = (idx, patch) => {
    setLimits((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }
  const addProductLimitRow = () => setLimits((prev) => [...prev, { kind: 'product', category: '', product: '', service: '', limit_quantity: '' }])
  const addServiceLimitRow = () => setLimits((prev) => [...prev, { kind: 'service', category: '', product: '', service: '', limit_quantity: '' }])
  const removeLimitRow = (idx) => setLimits((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  const productOptionsByCategory = (categoryId) => (categoryId ? products.filter((p) => String(p.category) === String(categoryId)) : [])

  const submit = async (e) => {
    e.preventDefault()
    if (!canManage) return
    setError('')
    if (!form.name.trim()) {
      setError('Укажите название типа')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        limit_amount: numberInputToApi(form.limit_amount),
        is_active: true,
        item_limits: limits
          .map((x) => {
            const base = { product: null, service: null, limit_quantity: numberInputToApi(x.limit_quantity) }
            if (x.kind === 'service') return { ...base, service: x.service ? Number(x.service) : null }
            return { ...base, product: x.product ? Number(x.product) : null }
          })
          .filter((x) => (x.product || x.service) && x.limit_quantity),
      }
      let saved
      if (isEdit) saved = await constructionApi.updateObjectType(id, payload)
      else saved = await constructionApi.createObjectType(payload)
      // Upload photo in a separate request to avoid multipart+nested array issues
      if (form.photo) {
        const targetId = isEdit ? id : saved?.id
        if (targetId) await constructionApi.uploadObjectTypePhoto(targetId, form.photo)
        window.alert('Фото успешно сохранено.')
      }
      navigate('/object-types')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось сохранить тип')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>{isEdit ? 'Редактировать тип объекта' : 'Создать тип объекта'}</h1>
        <Link to="/object-types" className={`${formStyles.btn} ${formStyles.btnSecondary}`}>← Назад</Link>
      </div>
      {loading ? <div>{t('common.loading')}</div> : (
        <div className={styles.pageBody}>
          <form onSubmit={submit} className={formStyles.form} style={{ maxWidth: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div className={formStyles.row}><label>Название</label><input className={formStyles.input} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></div>
              <div className={formStyles.row}><label>Код</label><input className={formStyles.input} value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} /></div>
              <div className={formStyles.row}><label>Лимит суммы</label><input inputMode="decimal" className={formStyles.input} value={formatNumberInput(form.limit_amount)} onChange={(e) => setForm((v) => ({ ...v, limit_amount: sanitizeNumberInput(e.target.value, 2) }))} /></div>
              <div className={formStyles.row} style={{ gridColumn: '1 / -1' }}><label>Описание</label><input className={formStyles.input} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} /></div>
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
            <div id="object-type-item-limits" className={formStyles.row}>
              <label>Лимиты по товарам и услугам</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {limits.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: row.kind === 'product' ? '180px 1fr 1fr 160px auto' : '1fr 160px auto', gap: 8 }}>
                    {row.kind === 'product' ? (
                      <>
                        <select className={formStyles.select} value={row.category} onChange={(e) => updateLimitRow(idx, { category: e.target.value, product: '' })}>
                          <option value="">— категория —</option>
                          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                        <select className={formStyles.select} value={row.product} onChange={(e) => updateLimitRow(idx, { product: e.target.value })} disabled={!row.category}>
                          <option value="">— товар —</option>
                          {productOptionsByCategory(row.category).map((p) => <option key={p.id} value={String(p.id)}>{p.sku} - {p.name}</option>)}
                        </select>
                      </>
                    ) : (
                      <select className={formStyles.select} value={row.service} onChange={(e) => updateLimitRow(idx, { service: e.target.value })}>
                        <option value="">— услуга —</option>
                        {services.map((s) => <option key={s.id} value={String(s.id)}>{s.code} - {s.name}</option>)}
                      </select>
                    )}
                    <input inputMode="decimal" className={formStyles.input} placeholder="Лимит" value={formatNumberInput(row.limit_quantity)} onChange={(e) => updateLimitRow(idx, { limit_quantity: sanitizeNumberInput(e.target.value, 3) })} />
                    <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={() => removeLimitRow(idx)}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={addProductLimitRow}>+ Добавить лимит товара</button>
                  <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={addServiceLimitRow}>+ Добавить лимит услуги</button>
                </div>
              </div>
            </div>
            {error ? <div className={formStyles.error}>{error}</div> : null}
            <div className={formStyles.actions}>
              <Link to="/object-types" className={`${formStyles.btn} ${formStyles.btnSecondary}`}>{t('common.cancel')}</Link>
              <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`} disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

