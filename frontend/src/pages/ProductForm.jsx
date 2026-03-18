import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { products } from '../api'
import styles from './Form.module.css'

const DEFAULT_UNIT = 'шт'

export default function ProductForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [categories, setCategories] = useState({ results: [] })
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    unit: DEFAULT_UNIT,
    description: '',
    amount: '0',
    is_active: true,
    photo: null,
  })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    products.categories().then((d) => setCategories(d.results || d || []))
  }, [])

  useEffect(() => {
    if (isEdit && id) {
      products.get(id).then((p) => {
        setForm({
          name: p.name || '',
          sku: p.sku || '',
          barcode: p.barcode || '',
          category: p.category || '',
          unit: p.unit || DEFAULT_UNIT,
          description: p.description || '',
          amount: String(p.amount ?? 0),
          is_active: p.is_active !== false,
          photo: null,
        })
        if (p.photo) setPhotoPreview(p.photo.startsWith('http') ? p.photo : `/${p.photo}`.replace('//', '/'))
      }).catch(() => setError('Not found'))
    }
  }, [id, isEdit])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setForm((prev) => ({ ...prev, photo: file }))
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        category: form.category || null,
        amount: form.amount === '' ? 0 : parseFloat(form.amount),
      }
      if (isEdit) {
        await products.update(id, payload)
      } else {
        await products.create(payload)
      }
      navigate('/products')
    } catch (err) {
      setError(err.response?.data?.detail || (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : 'Error'))
    } finally {
      setLoading(false)
    }
  }

  const photoUrl = photoPreview || (form.photo && form.photo instanceof File ? URL.createObjectURL(form.photo) : null)

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{isEdit ? t('products.editTitle') : t('products.new')}</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.row}>
          <label>{t('products.name')} *</label>
          <input className={styles.input} name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div className={styles.row}>
          <label>{t('products.sku')} *</label>
          <input className={styles.input} name="sku" value={form.sku} onChange={handleChange} required readOnly={isEdit} />
        </div>
        <div className={styles.row}>
          <label>{t('products.barcode')}</label>
          <input className={styles.input} name="barcode" value={form.barcode} onChange={handleChange} />
        </div>
        <div className={styles.row}>
          <label>{t('products.category')}</label>
          <select className={styles.select} name="category" value={form.category} onChange={handleChange}>
            <option value="">—</option>
            {(categories.results || categories).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.row}>
          <label>{t('products.unit')}</label>
          <input className={styles.input} name="unit" value={form.unit} onChange={handleChange} />
        </div>
        <div className={styles.row}>
          <label>{t('products.description')}</label>
          <textarea className={styles.textarea} name="description" value={form.description} onChange={handleChange} />
        </div>
        <div className={styles.row}>
          <label>{t('products.amount')}</label>
          <input className={styles.input} type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} />
        </div>
        <div className={styles.row}>
          <label>{t('common.photo')}</label>
          <div className={styles.photoWrap}>
            {photoUrl ? (
              <img src={photoUrl} alt="" className={styles.photoPreview} />
            ) : (
              <div className={styles.photoPlaceholder}>{t('common.none')}</div>
            )}
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
          </div>
        </div>
        <div className={`${styles.row} ${styles.checkRow}`}>
          <input type="checkbox" name="is_active" id="is_active" checked={form.is_active} onChange={handleChange} />
          <label htmlFor="is_active">{t('products.active')}</label>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
            {t('common.save')}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => navigate('/products')}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
