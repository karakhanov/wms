import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { suppliers } from '../api'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'

/**
 * Быстрое создание поставщика (вложенная модалка).
 * @param {{ open: boolean, onClose: () => void, onCreated: (created: object) => void, stacked?: boolean }} props
 */
export default function QuickSupplierModal({ open, onClose, onCreated, stackDepth = 0 }) {
  const outerStacked = stackDepth === 0 ? false : stackDepth
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', inn: '', contact: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ name: '', inn: '', contact: '' })
      setError('')
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setError(t('suppliers.name') + ' *')
      return
    }
    setError('')
    setLoading(true)
    try {
      const created = await suppliers.create(form)
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
    <Modal
      open={open}
      title={t('suppliers.new')}
      onClose={() => !loading && onClose()}
      stacked={outerStacked === false ? false : outerStacked}
      drawer
    >
      <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formModal}`}>
        {error && <div className={formStyles.error}>{error}</div>}
        <div className={formStyles.row}>
          <label>{t('suppliers.name')} *</label>
          <input
            className={formStyles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('suppliers.inn')}</label>
          <input
            className={formStyles.input}
            value={form.inn}
            onChange={(e) => setForm((f) => ({ ...f, inn: e.target.value }))}
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('suppliers.contact')}</label>
          <input
            className={formStyles.input}
            value={form.contact}
            onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
          />
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
