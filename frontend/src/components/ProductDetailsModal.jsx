import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { products as productsApi } from '../api'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'

function photoUrl(v) {
  if (!v) return null
  if (String(v).startsWith('http')) return v
  return `/${String(v)}`.replace(/^\/+/, '/')
}

export default function ProductDetailsModal({ open, productId, onClose, onEdit, onOpenPhoto, canManage }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [p, setP] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    setError('')
    try {
      const data = await productsApi.get(productId)
      setP(data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Not found')
      setP(null)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (!open) return
    setP(null)
    load()
  }, [open, load])

  const openDetailsPage = () => {
    if (!p?.id) return
    onClose?.()
    navigate(`/products/${p.id}/stock`)
  }

  return (
    <Modal open={open} xwide title={p ? p.name : 'Товар'} onClose={onClose}>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
      {loading && <div>{t('common.loading')}</div>}
      {!loading && p && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <img
                src={photoUrl(p.photo_url || p.photo)}
                alt=""
                style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                onClick={() => onOpenPhoto?.(p.id)}
              />
            </div>

            <button
              type="button"
              className={formStyles.btn + ' ' + formStyles.btnSecondary}
              onClick={openDetailsPage}
            >
              Подробная информация
            </button>

            {canManage && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => onEdit?.(p.id)} className={formStyles.btn + ' ' + formStyles.btnPrimary}>
                  {t('common.edit')}
                </button>
              </div>
            )}
          </div>

          <div style={{ overflow: 'auto', maxHeight: '70vh', paddingRight: 4, display: 'grid', gap: 10 }}>
            <div>
              <strong>{t('products.sku') || 'Артикул'}:</strong> {p.sku}
            </div>
            <div>
              <strong>{t('products.barcode') || 'Штрихкод'}:</strong> {p.barcode || t('common.none')}
            </div>
            <div>
              <strong>{t('products.category') || 'Категория'}:</strong> {p.category_name || t('common.none')}
            </div>
            <div>
              <strong>{t('products.unit') || 'Ед. изм'}:</strong> {p.unit}
            </div>
            <div>
              <strong>{t('products.amount') || 'Сумма'}:</strong> {p.amount}
            </div>
            <div>
              <strong>{t('products.active') || 'Активен'}:</strong> {p.is_active ? 'Да' : 'Нет'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <strong>{t('products.description') || 'Описание'}:</strong>
              <div>{p.description || t('common.none')}</div>
            </div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>
              <div>
                <span>#{p.id}</span>
              </div>
              <div>Создан: {p.created_at ? String(p.created_at).slice(0, 19).replace('T', ' ') : '—'}</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
