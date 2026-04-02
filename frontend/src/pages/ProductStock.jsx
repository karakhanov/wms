import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { products as productsApi } from '../api'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import { formatQuantity } from '../utils/formatQuantity'

function photoUrl(v) {
  if (!v) return null
  if (String(v).startsWith('http')) return v
  return `/${String(v)}`.replace(/^\/+/, '/')
}

function formatDate(v) {
  if (!v) return '—'
  const s = String(v)
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s
}

export default function ProductStock() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const h = await productsApi.history(id, {
        balances_limit: 30,
        receipts_limit: 0,
        shipments_limit: 0,
        transfers_limit: 0,
        inventories_limit: 0,
      })
      const p = await productsApi.get(id)
      setProduct(p)
      setHistory(h)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error')
      setProduct(null)
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{product ? product.name : 'Товар'} — Остатки</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" className={formStyles.btn + ' ' + formStyles.btnSecondary}>
            ← Назад
          </Link>
        </div>
      </div>

      {loading && <div>{t('common.loading')}</div>}
      {!loading && error && <div style={{ color: 'crimson' }}>{error}</div>}

      {!loading && !error && product && history && (
        <div className={styles.pageBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <img src={photoUrl(product.photo_url || product.photo)} alt="" style={{ width: '100%', display: 'block' }} />
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Минимальный уровень</div>
                {history.min_level ? (
                  <>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>{formatQuantity(history.min_level.min_quantity)}</div>
                    <div style={{ color: '#6b7280', marginTop: 6, fontSize: 13 }}>
                      Уведомлять: {history.min_level.notify ? 'Да' : 'Нет'}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#6b7280', marginTop: 8, fontSize: 13 }}>Не задано</div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h2 className={styles.h2} style={{ marginTop: 0 }}>
                  В каких складах сколько осталось
                </h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Склад</th>
                        <th>Количество</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.balances_by_warehouse || []).map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{r.warehouse_name}</td>
                          <td>{formatQuantity(r.quantity)}</td>
                        </tr>
                      ))}
                      {(history.balances_by_warehouse || []).length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ color: '#6b7280' }}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className={styles.h2}>По ячейкам (топ)</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Склад</th>
                        <th>Ячейка</th>
                        <th>Кол-во</th>
                        <th>Обновлено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.balances || []).map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{r.warehouse_name}</td>
                          <td>{r.cell_name}</td>
                          <td>{formatQuantity(r.quantity)}</td>
                          <td>{formatDate(r.updated_at)}</td>
                        </tr>
                      ))}
                      {(history.balances || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ color: '#6b7280' }}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

