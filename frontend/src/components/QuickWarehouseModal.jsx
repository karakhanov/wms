import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { warehouse as warehouseApi } from '../api'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'

/**
 * Быстрое создание склада.
 */
export default function QuickWarehouseModal({ open, onClose, onCreated, stackDepth = 0 }) {
  const outerStacked = stackDepth === 0 ? false : stackDepth
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ name: '', address: '' })
      setError('')
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setError(t('warehouse.nameRequired'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const created = await warehouseApi.warehouseCreate({ name, address: form.address.trim() || '', is_active: true })
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
      title={t('warehouse.newWarehouse')}
      onClose={() => !loading && onClose()}
      stacked={outerStacked === false ? false : outerStacked}
    >
      <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formModal}`}>
        {error && <div className={formStyles.error}>{error}</div>}
        <div className={formStyles.row}>
          <label>{t('warehouse.name')} *</label>
          <input
            className={formStyles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('warehouse.address')}</label>
          <input
            className={formStyles.input}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
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
