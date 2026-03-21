import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { products } from '../api'
import { useAuth } from '../auth'
import { canManageCategories } from '../permissions'
import Modal from './Modal'
import FkSelectRow from './FkSelectRow'
import QuickCategoryModal from './QuickCategoryModal'
import formStyles from '../pages/Form.module.css'

const DEFAULT_UNIT = 'шт'

const initialForm = {
  name: '',
  sku: '',
  barcode: '',
  category: '',
  unit: DEFAULT_UNIT,
  description: '',
  amount: '0',
  is_active: true,
  photo: null,
}

/**
 * @param {{ open: boolean, productId: number | null, onClose: () => void, onSaved: () => void }} props
 */
export default function ProductEditorModal({ open, productId, onClose, onSaved }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canAddCategory = canManageCategories(user)
  const isEdit = productId != null
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [form, setForm] = useState(initialForm)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false)

  const reset = useCallback(() => {
    setForm(initialForm)
    setPhotoPreview(null)
    setError('')
  }, [])

  const reloadCategories = useCallback(async () => {
    try {
      const d = await products.categories()
      setCategories(d.results || d || [])
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    reloadCategories()
    products
      .units()
      .then((d) => setUnits(d.results || d || []))
      .catch(() => setUnits([]))
  }, [open, reloadCategories])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      reset()
      return
    }
    setError('')
    products
      .get(productId)
      .then((p) => {
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
        else setPhotoPreview(null)
      })
      .catch(() => setError('Not found'))
  }, [open, productId, isEdit, reset])

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
        await products.update(productId, payload)
      } else {
        await products.create(payload)
      }
      onSaved()
      onClose()
      reset()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : 'Error')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      reset()
      setQuickCategoryOpen(false)
      onClose()
    }
  }

  /** Escape / клик по фону: сначала закрыть вложенную модалку категории */
  const closeMainOrNested = () => {
    if (quickCategoryOpen) {
      setQuickCategoryOpen(false)
      return
    }
    handleClose()
  }

  const photoUrl =
    photoPreview || (form.photo && form.photo instanceof File ? URL.createObjectURL(form.photo) : null)

  const title = isEdit ? t('products.editTitle') : t('products.new')
  const categoryValue = form.category === '' || form.category == null ? '' : String(form.category)

  return (
    <>
      <Modal open={open} title={title} onClose={closeMainOrNested} wide>
        <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formModal}`}>
          {error && <div className={formStyles.error}>{error}</div>}
          <div className={formStyles.row}>
            <label>{t('products.name')} *</label>
            <input className={formStyles.input} name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className={formStyles.row}>
            <label>{t('products.sku')} *</label>
            <input
              className={formStyles.input}
              name="sku"
              value={form.sku}
              onChange={handleChange}
              required
              readOnly={isEdit}
            />
          </div>
          <div className={formStyles.row}>
            <label>{t('products.barcode')}</label>
            <input className={formStyles.input} name="barcode" value={form.barcode} onChange={handleChange} />
          </div>
          <FkSelectRow
            label={t('products.category')}
            canAdd={canAddCategory}
            onAdd={() => setQuickCategoryOpen(true)}
            addTitle={t('products.addCategoryInline')}
            addAriaLabel={t('products.addCategoryInline')}
          >
            <select
              className={`${formStyles.select} ${formStyles.fkSelect}`}
              name="category"
              value={categoryValue}
              onChange={handleChange}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FkSelectRow>
          <div className={formStyles.row}>
            <label>{t('products.unit')}</label>
            <select className={formStyles.select} name="unit" value={form.unit} onChange={handleChange}>
              {units.map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.symbol} — {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.row}>
            <label>{t('products.description')}</label>
            <textarea className={formStyles.textarea} name="description" value={form.description} onChange={handleChange} />
          </div>
          <div className={formStyles.row}>
            <label>{t('products.amount')}</label>
            <input
              className={formStyles.input}
              type="number"
              step="0.01"
              name="amount"
              value={form.amount}
              onChange={handleChange}
            />
          </div>
          <div className={formStyles.row}>
            <label>{t('common.photo')}</label>
            <div className={formStyles.photoWrap}>
              {photoUrl ? (
                <img src={photoUrl} alt="" className={formStyles.photoPreview} />
              ) : (
                <div className={formStyles.photoPlaceholder}>{t('common.none')}</div>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </div>
          </div>
          <div className={`${formStyles.row} ${formStyles.checkRow}`}>
            <input type="checkbox" name="is_active" id="product_is_active" checked={form.is_active} onChange={handleChange} />
            <label htmlFor="product_is_active">{t('products.active')}</label>
          </div>
          <div className={formStyles.actions}>
            <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`} disabled={loading}>
              {t('common.save')}
            </button>
            <button
              type="button"
              className={`${formStyles.btn} ${formStyles.btnSecondary}`}
              onClick={handleClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </Modal>

      <QuickCategoryModal
        open={quickCategoryOpen}
        onClose={() => setQuickCategoryOpen(false)}
        categories={categories}
        excludeParentIds={[]}
        stackDepth={1}
        onCreated={async (created) => {
          await reloadCategories()
          const newId = created?.id
          if (newId != null) {
            setForm((f) => ({ ...f, category: String(newId) }))
          }
        }}
      />
    </>
  )
}
