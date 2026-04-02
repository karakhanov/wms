import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { products as productsApi } from '../api'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import { formatQuantity } from '../utils/formatQuantity'
import PaginationBar from '../components/PaginationBar'
import { totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'

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

export default function ProductOps() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [transfersPage, setTransfersPage] = useState(1)
  const [inventoriesPage, setInventoriesPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const h = await productsApi.history(id, {
        balances_limit: 1,
        receipts_limit: 0,
        shipments_limit: 0,
        transfers_limit: pageSize,
        transfers_offset: (transfersPage - 1) * pageSize,
        inventories_limit: pageSize,
        inventories_offset: (inventoriesPage - 1) * pageSize,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
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
  }, [id, appliedFrom, appliedTo, transfersPage, inventoriesPage, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const applyDates = () => {
    setTransfersPage(1)
    setInventoriesPage(1)
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
  }

  const transfersTotal = Number(history?.transfers_total ?? 0)
  const inventoriesTotal = Number(history?.inventories_total ?? 0)
  const transfersPageCount = totalPages(transfersTotal, pageSize)
  const inventoriesPageCount = totalPages(inventoriesTotal, pageSize)

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{product ? product.name : 'Товар'} — Перемещения / Инвентаризация</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" className={formStyles.btn + ' ' + formStyles.btnSecondary}>
            ← Назад
          </Link>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>От</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={formStyles.input} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>До</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={formStyles.input} />
            </div>
            <button
              type="button"
              className={formStyles.btn + ' ' + formStyles.btnPrimary}
              onClick={applyDates}
              disabled={loading}
              style={{ height: 36 }}
            >
              Применить
            </button>
          </div>
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
              <div style={{ color: '#6b7280', fontSize: 13 }}>Последние операции по этому товару.</div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h2 className={styles.h2} style={{ marginTop: 0 }}>
                  Перемещения
                </h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Кол-во</th>
                        <th>Из → В</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.transfers || []).map((r, i) => (
                        <tr key={i}>
                          <td>{(transfersPage - 1) * pageSize + i + 1}</td>
                          <td>{formatDate(r.date)}</td>
                          <td>{formatQuantity(r.quantity)}</td>
                          <td>{`${r.cell_from || '—'} → ${r.cell_to || '—'}`}</td>
                          <td>{r.comment || '—'}</td>
                        </tr>
                      ))}
                      {(history.transfers || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ color: '#6b7280' }}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.paginationDock} style={{ marginTop: 10 }}>
                  <PaginationBar
                    page={transfersPage}
                    pageCount={transfersPageCount}
                    total={transfersTotal}
                    onPageChange={setTransfersPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <h2 className={styles.h2}>Инвентаризация</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Склад</th>
                        <th>Δ</th>
                        <th>Факт</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.inventories || []).map((r, i) => (
                        <tr key={i}>
                          <td>{(inventoriesPage - 1) * pageSize + i + 1}</td>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.warehouse_name}</td>
                          <td>{formatQuantity(r.difference)}</td>
                          <td>{formatQuantity(r.quantity_actual)}</td>
                        </tr>
                      ))}
                      {(history.inventories || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ color: '#6b7280' }}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.paginationDock} style={{ marginTop: 10 }}>
                  <PaginationBar
                    page={inventoriesPage}
                    pageCount={inventoriesPageCount}
                    total={inventoriesTotal}
                    onPageChange={setInventoriesPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

