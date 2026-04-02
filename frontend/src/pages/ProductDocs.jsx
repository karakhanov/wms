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

export default function ProductDocs() {
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

  const [receiptsPage, setReceiptsPage] = useState(1)
  const [shipmentsPage, setShipmentsPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const h = await productsApi.history(id, {
        balances_limit: 1,
        receipts_limit: pageSize,
        receipts_offset: (receiptsPage - 1) * pageSize,
        shipments_limit: pageSize,
        shipments_offset: (shipmentsPage - 1) * pageSize,
        transfers_limit: 0,
        inventories_limit: 0,
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
  }, [id, appliedFrom, appliedTo, receiptsPage, shipmentsPage, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const applyDates = () => {
    setReceiptsPage(1)
    setShipmentsPage(1)
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
  }

  const receiptsTotal = Number(history?.receipts_total ?? 0)
  const shipmentsTotal = Number(history?.shipments_total ?? 0)
  const receiptsPageCount = totalPages(receiptsTotal, pageSize)
  const shipmentsPageCount = totalPages(shipmentsTotal, pageSize)

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{product ? product.name : 'Товар'} — Приход / Отгрузка</h1>
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
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                Показываем последние документы по этому товару.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h2 className={styles.h2} style={{ marginTop: 0 }}>
                  Приход (приёмки)
                </h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Поставщик</th>
                        <th>Кол-во</th>
                        <th>Ячейка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.receipts || []).map((r, i) => (
                        <tr key={i}>
                          <td>{(receiptsPage - 1) * pageSize + i + 1}</td>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.supplier_name}</td>
                          <td>{formatQuantity(r.quantity)}</td>
                          <td>{r.cell_name}</td>
                        </tr>
                      ))}
                      {(history.receipts || []).length === 0 && (
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
                    page={receiptsPage}
                    pageCount={receiptsPageCount}
                    total={receiptsTotal}
                    onPageChange={setReceiptsPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <h2 className={styles.h2}>Отгрузка (отправленные)</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Клиент</th>
                        <th>Кол-во</th>
                        <th>Ячейка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.shipments || []).map((r, i) => (
                        <tr key={i}>
                          <td>{(shipmentsPage - 1) * pageSize + i + 1}</td>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.client_name}</td>
                          <td>{formatQuantity(r.quantity)}</td>
                          <td>{r.cell_name || '—'}</td>
                        </tr>
                      ))}
                      {(history.shipments || []).length === 0 && (
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
                    page={shipmentsPage}
                    pageCount={shipmentsPageCount}
                    total={shipmentsTotal}
                    onPageChange={setShipmentsPage}
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

