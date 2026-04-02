import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'
import styles from './ConfirmDeleteModal.module.css'

/**
 * @param {{ open: boolean, itemName: string, onClose: () => void, onConfirm: () => void | Promise<void> }} props
 */
export default function ConfirmDeleteModal({ open, itemName, onClose, onConfirm }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) setPending(false)
  }, [open])

  const handleConfirm = async () => {
    setPending(true)
    try {
      await Promise.resolve(onConfirm())
      onClose()
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Error'
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setPending(false)
    }
  }

  const name = (itemName && String(itemName).trim()) || t('common.recordFallback')

  return (
    <Modal open={open} title={t('common.confirmDeleteTitle')} onClose={() => { if (!pending) onClose() }} stacked>
      <p className={styles.message}>{t('common.confirmDeleteBody', { name })}</p>
      <div className={styles.footer}>
        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={onClose} disabled={pending}>
          {t('common.cancel')}
        </button>
        <button type="button" className={`${formStyles.btn} ${formStyles.btnDangerFilled}`} onClick={handleConfirm} disabled={pending}>
          {t('common.delete')}
        </button>
      </div>
    </Modal>
  )
}
