import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { warehouse as warehouseApi } from '../api'
import Modal from './Modal'
import FkSelectRow from './FkSelectRow'
import QuickWarehouseModal from './QuickWarehouseModal'
import formStyles from '../pages/Form.module.css'

/**
 * Быстрое создание зоны (FK → склад).
 * @param {{ open: boolean, onClose: () => void, onCreated: (z: object) => void, defaultWarehouseId?: number|string, stackDepth?: number }} props
 */
export default function QuickZoneModal({ open, onClose, onCreated, defaultWarehouseId = '', stackDepth = 0 }) {
  const outerStacked = stackDepth === 0 ? false : stackDepth
  const { t } = useTranslation()
  const [warehouses, setWarehouses] = useState([])
  const [form, setForm] = useState({ name: '', code: '', warehouse: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quickWhOpen, setQuickWhOpen] = useState(false)

  const reloadWarehouses = useCallback(async () => {
    try {
      const d = await warehouseApi.warehouses()
      setWarehouses(d.results || d || [])
    } catch {
      setWarehouses([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    reloadWarehouses()
    setForm({
      name: '',
      code: '',
      warehouse: defaultWarehouseId === '' || defaultWarehouseId == null ? '' : String(defaultWarehouseId),
    })
    setError('')
    setQuickWhOpen(false)
  }, [open, defaultWarehouseId, reloadWarehouses])

  const closeMainOrNested = () => {
    if (quickWhOpen) {
      setQuickWhOpen(false)
      return
    }
    if (!loading) onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setError(t('warehouse.zoneNameRequired'))
      return
    }
    if (!form.warehouse) {
      setError(t('warehouse.selectWarehouse'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const created = await warehouseApi.zoneCreate({
        name,
        code: form.code.trim() || '',
        warehouse: Number(form.warehouse),
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

  const whValue = form.warehouse === '' || form.warehouse == null ? '' : String(form.warehouse)

  return (
    <>
      <Modal
        open={open}
        title={t('warehouse.newZone')}
        onClose={closeMainOrNested}
        stacked={outerStacked === false ? false : outerStacked}
      >
        <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formModal}`}>
          {error && <div className={formStyles.error}>{error}</div>}
          <FkSelectRow
            label={`${t('warehouse.wh')} *`}
            canAdd
            onAdd={() => setQuickWhOpen(true)}
            addTitle={t('warehouse.addWarehouseInline')}
            addAriaLabel={t('warehouse.addWarehouseInline')}
          >
            <select
              className={`${formStyles.select} ${formStyles.fkSelect}`}
              value={whValue}
              onChange={(e) => setForm((f) => ({ ...f, warehouse: e.target.value }))}
              required
            >
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </FkSelectRow>
          <div className={formStyles.row}>
            <label>{t('warehouse.zoneName')} *</label>
            <input
              className={formStyles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className={formStyles.row}>
            <label>{t('warehouse.zoneCode')}</label>
            <input
              className={formStyles.input}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
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

      <QuickWarehouseModal
        open={quickWhOpen}
        onClose={() => setQuickWhOpen(false)}
        stackDepth={stackDepth + 1}
        onCreated={async (created) => {
          await reloadWarehouses()
          if (created?.id != null) {
            setForm((f) => ({ ...f, warehouse: String(created.id) }))
          }
        }}
      />
    </>
  )
}
