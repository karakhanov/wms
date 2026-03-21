import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { products } from '../api'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'

/**
 * Быстрое создание категории (вложенная модалка).
 * @param {{ open: boolean, onClose: () => void, onCreated: (created: object) => void, categories: Array<{id:number,name:string}>, excludeParentIds?: number[], stackDepth?: number }} props
 */
export default function QuickCategoryModal({
  open,
  onClose,
  onCreated,
  categories = [],
  excludeParentIds = [],
  stackDepth = 1,
}) {
  const { t } = useTranslation()
  const [quickCat, setQuickCat] = useState({ name: '', parent: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setQuickCat({ name: '', parent: '' })
      setError('')
    }
  }, [open])

  const parentOptions = categories.filter((c) => !excludeParentIds.includes(c.id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = quickCat.name.trim()
    if (!name) {
      setError(t('products.quickCategoryNameRequired'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const created = await products.categoryCreate({
        name,
        parent: quickCat.parent || null,
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : 'Error')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} title={t('categories.new')} onClose={() => !loading && onClose()} stacked={stackDepth}>
      <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formModal}`}>
        {error && <div className={formStyles.error}>{error}</div>}
        <div className={formStyles.row}>
          <label>{t('categories.name')} *</label>
          <input
            className={formStyles.input}
            value={quickCat.name}
            onChange={(e) => setQuickCat((q) => ({ ...q, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('categories.parent')}</label>
          <select
            className={formStyles.select}
            value={quickCat.parent}
            onChange={(e) => setQuickCat((q) => ({ ...q, parent: e.target.value }))}
          >
            <option value="">—</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className={formStyles.actions}>
          <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`} disabled={loading}>
            {t('common.save')}
          </button>
          <button
            type="button"
            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
            disabled={loading}
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
