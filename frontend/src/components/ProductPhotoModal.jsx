import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { products as productsApi } from '../api'
import Modal from './Modal'
import formStyles from '../pages/Form.module.css'

function photoUrl(v) {
  if (!v) return null
  if (String(v).startsWith('http')) return v
  return `/${String(v)}`.replace(/^\/+/, '/')
}

export default function ProductPhotoModal({ open, productId, onClose, onSaved, canManage }) {
  const { t } = useTranslation()
  const [p, setP] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    setError('')
    try {
      const data = await productsApi.get(productId)
      setP(data)
      setFile(null)
      setPreview(null)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Not found')
      setP(null)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  const mainPhoto = preview || photoUrl(p?.photo_url || p?.photo)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    if (!file || !canManage) return
    setSaving(true)
    setError('')
    try {
      await productsApi.update(productId, { photo: file })
      setFile(null)
      setPreview(null)
      await load()
      onSaved?.()
    } catch (e) {
      setError(e?.response?.data?.detail || (typeof e?.response?.data === 'object' ? JSON.stringify(e.response.data) : 'Error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!canManage) return
    setSaving(true)
    setError('')
    try {
      await productsApi.update(productId, { photo: null })
      setFile(null)
      setPreview(null)
      await load()
      onSaved?.()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} wide title={t('common.photo') || 'Фото'} onClose={onClose}>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
      {loading && <div>{t('common.loading')}</div>}
      {!loading && p && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {mainPhoto ? (
              <img src={mainPhoto} alt="" style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ padding: 20, color: '#6b7280' }}>{t('common.none') || '—'}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>SKU</div>
              <div style={{ fontWeight: 600 }}>{p.sku}</div>
            </div>

            {canManage ? (
              <>
                <div className={formStyles.row}>
                  <label>Загрузить фото</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className={formStyles.btn + ' ' + formStyles.btnPrimary} onClick={handleSave} disabled={saving || !file}>
                    {t('common.save')}
                  </button>
                  <button type="button" className={formStyles.btn + ' ' + formStyles.btnDanger} onClick={handleDelete} disabled={saving}>
                    {t('common.delete')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 14 }}>
                {t('common.readOnly') || 'Только просмотр.'}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

