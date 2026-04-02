import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link, useLocation } from 'react-router-dom'
import { products as productsApi } from '../api'
import ProductEditorModal from '../components/ProductEditorModal'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import pageStyles from './ProductDetailsPage.module.css'
import panelStyles from './DataPanelLayout.module.css'
import viewStyles from './ObjectEntityDetails.module.css'
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

function shiftIsoDate(isoDate, deltaDays) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

export default function ProductDetailsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const location = useLocation()

  const routeTab = useMemo(() => {
    if (location.pathname.endsWith('/docs')) return 'receipts'
    if (location.pathname.endsWith('/ops')) return 'transfers'
    return 'stock'
  }, [location.pathname])

  const [tab, setTab] = useState(routeTab)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState(null)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const [docFilters, setDocFilters] = useState({
    receipts: { from: '', to: '' },
    shipments: { from: '', to: '' },
    transfers: { from: '', to: '' },
    inventories: { from: '', to: '' },
  })
  /** Поиск по колонкам таблицы; на бэкенде отдельный параметр для каждого типа документов. */
  const [docSearch, setDocSearch] = useState({
    receipts: '',
    shipments: '',
    transfers: '',
    inventories: '',
  })
  const [stockWarehouseQuery, setStockWarehouseQuery] = useState('')
  const [stockOnlyPositive, setStockOnlyPositive] = useState(false)

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [receiptsPage, setReceiptsPage] = useState(1)
  const [shipmentsPage, setShipmentsPage] = useState(1)
  const [transfersPage, setTransfersPage] = useState(1)
  const [inventoriesPage, setInventoriesPage] = useState(1)

  useEffect(() => { setTab(routeTab) }, [routeTab])

  const loadProduct = useCallback(async () => {
    setLoadingProduct(true)
    setError('')
    try {
      const p = await productsApi.get(id)
      setProduct(p)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error')
      setProduct(null)
    } finally {
      setLoadingProduct(false)
    }
  }, [id])

  const dateParamsForTab = useMemo(() => {
    if (tab === 'receipts' || tab === 'shipments' || tab === 'transfers' || tab === 'inventories') {
      const { from, to } = docFilters[tab]
      return { from: from || undefined, to: to || undefined }
    }
    return {}
  }, [tab, docFilters])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    setError('')
    try {
      const base = dateParamsForTab
      let historyParams
      if (tab === 'stock') {
        historyParams = {
          ...base,
          balances_limit: 30,
          receipts_limit: 0,
          shipments_limit: 0,
          transfers_limit: 0,
          inventories_limit: 0,
        }
      } else if (tab === 'receipts') {
        historyParams = {
          ...base,
          balances_limit: 1,
          receipts_limit: pageSize,
          receipts_offset: (receiptsPage - 1) * pageSize,
          receipts_q: docSearch.receipts.trim() || undefined,
          shipments_limit: 0,
          transfers_limit: 0,
          inventories_limit: 0,
        }
      } else if (tab === 'shipments') {
        historyParams = {
          ...base,
          balances_limit: 1,
          receipts_limit: 0,
          shipments_limit: pageSize,
          shipments_offset: (shipmentsPage - 1) * pageSize,
          shipments_q: docSearch.shipments.trim() || undefined,
          transfers_limit: 0,
          inventories_limit: 0,
        }
      } else if (tab === 'transfers') {
        historyParams = {
          ...base,
          balances_limit: 1,
          receipts_limit: 0,
          shipments_limit: 0,
          transfers_limit: pageSize,
          transfers_offset: (transfersPage - 1) * pageSize,
          transfers_q: docSearch.transfers.trim() || undefined,
          inventories_limit: 0,
        }
      } else {
        historyParams = {
          ...base,
          balances_limit: 1,
          receipts_limit: 0,
          shipments_limit: 0,
          transfers_limit: 0,
          inventories_limit: pageSize,
          inventories_offset: (inventoriesPage - 1) * pageSize,
          inventories_q: docSearch.inventories.trim() || undefined,
        }
      }

      const h = await productsApi.history(id, historyParams)
      setHistory(h)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error')
      setHistory(null)
    } finally {
      setLoadingHistory(false)
    }
  }, [id, tab, dateParamsForTab, docSearch, pageSize, receiptsPage, shipmentsPage, transfersPage, inventoriesPage])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadHistory])

  useEffect(() => {
    setReceiptsPage(1)
  }, [docFilters.receipts.from, docFilters.receipts.to])
  useEffect(() => {
    setShipmentsPage(1)
  }, [docFilters.shipments.from, docFilters.shipments.to])
  useEffect(() => {
    setTransfersPage(1)
  }, [docFilters.transfers.from, docFilters.transfers.to])
  useEffect(() => {
    setInventoriesPage(1)
  }, [docFilters.inventories.from, docFilters.inventories.to])

  useEffect(() => {
    setReceiptsPage(1)
  }, [docSearch.receipts])
  useEffect(() => {
    setShipmentsPage(1)
  }, [docSearch.shipments])
  useEffect(() => {
    setTransfersPage(1)
  }, [docSearch.transfers])
  useEffect(() => {
    setInventoriesPage(1)
  }, [docSearch.inventories])

  const switchTab = (nextTab) => setTab(nextTab)

  const onPhotoChange = async (file) => {
    if (!file || !product?.id) return
    setPhotoBusy(true)
    setError('')
    try {
      await productsApi.update(product.id, { photo: file })
      await loadProduct()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось обновить фото')
    } finally {
      setPhotoBusy(false)
    }
  }

  const onPhotoDelete = async () => {
    if (!product?.id) return
    setPhotoBusy(true)
    setError('')
    try {
      await productsApi.update(product.id, { photo: null })
      await loadProduct()
      setPhotoViewerOpen(false)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось удалить фото')
    } finally {
      setPhotoBusy(false)
    }
  }

  const applyPreset = (days) => {
    if (tab !== 'receipts' && tab !== 'shipments' && tab !== 'transfers' && tab !== 'inventories') return
    if (!days) {
      setDocFilters((prev) => ({ ...prev, [tab]: { from: '', to: '' } }))
      setDocSearch((prev) => ({ ...prev, [tab]: '' }))
      return
    }
    const now = new Date()
    const from = new Date(now)
    from.setDate(now.getDate() - (days - 1))
    const toValue = now.toISOString().slice(0, 10)
    const fromValue = from.toISOString().slice(0, 10)
    setDocFilters((prev) => ({ ...prev, [tab]: { from: fromValue, to: toValue } }))
  }

  const activePreset = useMemo(() => {
    if (tab === 'stock') return null
    const fromDate = docFilters[tab].from
    const toDate = docFilters[tab].to
    if (!fromDate && !toDate) return 0
    if (!fromDate || !toDate) return null
    if (fromDate > toDate) return null

    const today = new Date().toISOString().slice(0, 10)
    if (toDate !== today) return null
    if (fromDate === today) return 1
    if (fromDate === shiftIsoDate(today, -6)) return 7
    if (fromDate === shiftIsoDate(today, -29)) return 30
    return null
  }, [tab, docFilters])

  const totalStockQty = useMemo(() => {
    const rows = history?.balances_by_warehouse || []
    return rows.reduce((s, r) => s + Math.max(0, Number(r.quantity ?? 0)), 0)
  }, [history])

  /** Доли остатка по складам (balances_by_warehouse), до 4 сегментов + «Прочие склады». */
  const stockStats = useMemo(() => {
    const balancesByWarehouse = history?.balances_by_warehouse || []
    const withStock = balancesByWarehouse
      .map((r) => ({
        warehouse_name: r.warehouse_name || '—',
        quantity: Math.max(0, Number(r.quantity ?? 0)),
      }))
      .filter((r) => r.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
    const maxSeg = 4
    if (withStock.length === 0) return []
    if (withStock.length <= maxSeg) {
      return withStock.map((r, i) => ({
        key: `wh-${i}-${r.warehouse_name}`,
        label: r.warehouse_name,
        value: r.quantity,
      }))
    }
    const top = withStock.slice(0, maxSeg - 1)
    const rest = withStock.slice(maxSeg - 1).reduce((s, r) => s + r.quantity, 0)
    return [
      ...top.map((r, i) => ({
        key: `wh-${i}-${r.warehouse_name}`,
        label: r.warehouse_name,
        value: r.quantity,
      })),
      { key: 'other-wh', label: 'Прочие склады', value: rest },
    ]
  }, [history])

  const receiptsTotal = Number(history?.receipts_total ?? 0)
  const shipmentsTotal = Number(history?.shipments_total ?? 0)
  const transfersTotal = Number(history?.transfers_total ?? 0)
  const inventoriesTotal = Number(history?.inventories_total ?? 0)
  const balancesByWarehouse = history?.balances_by_warehouse || []
  const receipts = history?.receipts || []
  const shipments = history?.shipments || []
  const transfers = history?.transfers || []
  const inventories = history?.inventories || []

  const filteredBalancesByWarehouse = useMemo(() => {
    let rows = balancesByWarehouse
    if (stockOnlyPositive) rows = rows.filter((r) => Number(r.quantity ?? 0) > 0)
    const q = stockWarehouseQuery.trim().toLowerCase()
    if (q) rows = rows.filter((r) => (String(r.warehouse_name || '').toLowerCase()).includes(q))
    return rows
  }, [balancesByWarehouse, stockOnlyPositive, stockWarehouseQuery])

  const setDocFilterField = (key, field, value) => {
    setDocFilters((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const setDocSearchField = (key, value) => {
    setDocSearch((prev) => ({ ...prev, [key]: value }))
  }

  const docDateScopeLabels = {
    receipts: 'По дате приёмки',
    shipments: 'По дате заказа',
    transfers: 'По дате перемещения',
    inventories: 'По дате инвентаризации',
  }

  const docSearchPlaceholders = {
    receipts: 'Поставщик',
    shipments: 'Клиент',
    transfers: 'Комментарий, ячейка…',
    inventories: 'Склад',
  }

  const donutColors = ['#22c55e', '#14b8a6', '#3b82f6', '#a855f7', '#f59e0b']

  return (
    <div className={styles.page}>
      <ProductEditorModal
        open={editorOpen}
        productId={product?.id || null}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false)
          loadProduct()
        }}
      />
      <div className={styles.pageHead}>
        <Link to="/products" className={viewStyles.backTextLink}>← Назад к товарам</Link>
      </div>

      {loadingProduct && <div className={styles.stateCard}>{t('common.loading')}</div>}
      {!loadingProduct && error && <div className={formStyles.error}>{error}</div>}

      {!loadingProduct && !error && product && (
        <>
          <section className={pageStyles.unifiedCard}>
            <div className={pageStyles.topSummary}>
              {photoUrl(product.photo_url || product.photo) ? (
                <button type="button" className={pageStyles.summaryThumbBtn} onClick={() => setPhotoViewerOpen(true)}>
                  <img src={photoUrl(product.photo_url || product.photo)} alt="" className={pageStyles.summaryThumb} />
                </button>
              ) : (
                <button type="button" className={pageStyles.summaryThumbBtn} onClick={() => setPhotoViewerOpen(true)}>
                  <span className={pageStyles.summaryThumbPlaceholder} aria-hidden />
                </button>
              )}
              <div className={pageStyles.summaryMeta}>
                <h1 className={pageStyles.summaryTitle}>{product.name}</h1>
                <div className={pageStyles.summarySub}>SKU: {product.sku || '—'}</div>
              </div>
              <div className={pageStyles.summaryActions}>
                <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={() => setEditorOpen(true)}>
                  Изменить
                </button>
              </div>
            </div>
            {!summaryCollapsed ? (
              <div className={pageStyles.twoCol}>
                <section className={pageStyles.panelCard}>
                  <h2 className={pageStyles.panelTitle}>Основная информация</h2>
                  <div className={pageStyles.panelBody}>
                    <div className={pageStyles.infoGrid}>
                      <div className={pageStyles.row}><span className={pageStyles.k}>Название</span><span>{product.name || '—'}</span></div>
                      <div className={pageStyles.row}><span className={pageStyles.k}>SKU</span><span>{product.sku || '—'}</span></div>
                      <div className={pageStyles.row}><span className={pageStyles.k}>ID</span><span>{product.id || '—'}</span></div>
                      <div className={pageStyles.row}><span className={pageStyles.k}>Штрихкод</span><span>{product.barcode || '—'}</span></div>
                      <div className={pageStyles.row}><span className={pageStyles.k}>Категория</span><span>{product.category_name || '—'}</span></div>
                      <div className={pageStyles.row}><span className={pageStyles.k}>Ед. изм.</span><span>{product.unit || '—'}</span></div>
                    </div>
                    <div className={pageStyles.desc}>
                      <div className={pageStyles.k}>Описание</div>
                      <div>{product.description || '—'}</div>
                    </div>
                  </div>
                </section>
                <section className={pageStyles.panelCard}>
                  <h2 className={pageStyles.panelTitle}>Остатки по складам</h2>
                  <div className={pageStyles.panelBody}>
                <div className={pageStyles.statsChartWrap}>
                  <div className={pageStyles.statsChart}>
                  <svg viewBox="0 0 220 220" className={pageStyles.singleChart} role="img" aria-label="Доля остатка по складам">
                    {stockStats.reduce((acc, item, idx) => {
                      const normalized = totalStockQty > 0 ? Math.max(0, item.value) / totalStockQty : 0
                      const dash = normalized * 314.159
                      const segment = (
                        <circle
                          key={item.key}
                          cx="110"
                          cy="110"
                          r="50"
                          fill="none"
                          stroke={donutColors[idx]}
                          strokeWidth="18"
                          strokeDasharray={`${dash} ${314.159 - dash}`}
                          strokeDashoffset={-acc.offset}
                          transform="rotate(-90 110 110)"
                          strokeLinecap="butt"
                        />
                      )
                      acc.offset += dash
                      acc.nodes.push(segment)
                      return acc
                    }, { offset: 0, nodes: [] }).nodes}
                    <circle cx="110" cy="110" r="32" fill="var(--glass-bg-strong)" />
                    <text x="110" y="106" textAnchor="middle" className={pageStyles.donutCenterLabel}>Всего</text>
                    <text x="110" y="124" textAnchor="middle" className={pageStyles.donutCenterValue}>{formatQuantity(totalStockQty)}</text>
                  </svg>
                  </div>
                  <div className={pageStyles.chartLegend}>
                    {stockStats.length === 0 && (
                      <div className={`${pageStyles.legendRow} ${pageStyles.legendRowEmpty}`}>
                        <span className={pageStyles.legendLabel}>Нет остатков на складах</span>
                        <span className={pageStyles.legendValue}>0</span>
                      </div>
                    )}
                    {stockStats.map((item, idx) => (
                      <div key={item.key} className={pageStyles.legendRow}>
                        <span className={pageStyles.legendDot} style={{ backgroundColor: donutColors[idx % donutColors.length] }} />
                        <span className={pageStyles.legendLabel}>{item.label}</span>
                        <span className={pageStyles.legendValue}>{formatQuantity(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className={pageStyles.collapsedMeta}>
                ID: {product.id || '—'} | Категория: {product.category_name || '—'} | Остаток: {formatQuantity(totalStockQty)}
              </div>
            )}
            <div className={pageStyles.collapseFooter}>
              <button
                type="button"
                className={pageStyles.collapseIconBtn}
                onClick={() => setSummaryCollapsed((v) => !v)}
                aria-label={summaryCollapsed ? 'Развернуть' : 'Свернуть'}
                title={summaryCollapsed ? 'Развернуть' : 'Свернуть'}
              >
                <span className={`${pageStyles.collapseIcon} ${summaryCollapsed ? pageStyles.collapseIconDown : pageStyles.collapseIconUp}`} />
              </button>
            </div>
          </section>

          {/* Табы + одна карточка: фильтры и таблица */}
          <div className={panelStyles.dataPanelSection}>
            <div className={panelStyles.tabsBar} role="tablist" aria-label="Разделы карточки товара">
              <button type="button" role="tab" aria-selected={tab === 'stock'} className={formStyles.btn + ' ' + (tab === 'stock' ? formStyles.btnPrimary : formStyles.btnSecondary)} onClick={() => switchTab('stock')}>
                Остатки
              </button>
              <button type="button" role="tab" aria-selected={tab === 'receipts'} className={formStyles.btn + ' ' + (tab === 'receipts' ? formStyles.btnPrimary : formStyles.btnSecondary)} onClick={() => switchTab('receipts')}>
                Приход
              </button>
              <button type="button" role="tab" aria-selected={tab === 'shipments'} className={formStyles.btn + ' ' + (tab === 'shipments' ? formStyles.btnPrimary : formStyles.btnSecondary)} onClick={() => switchTab('shipments')}>
                Отгрузка
              </button>
              <button type="button" role="tab" aria-selected={tab === 'transfers'} className={formStyles.btn + ' ' + (tab === 'transfers' ? formStyles.btnPrimary : formStyles.btnSecondary)} onClick={() => switchTab('transfers')}>
                Перемещения
              </button>
              <button type="button" role="tab" aria-selected={tab === 'inventories'} className={formStyles.btn + ' ' + (tab === 'inventories' ? formStyles.btnPrimary : formStyles.btnSecondary)} onClick={() => switchTab('inventories')}>
                Инвентаризация
              </button>
            </div>

            <div className={panelStyles.dataPanelCard}>
              <div className={panelStyles.dataPanelToolbar}>
                <div className={panelStyles.filterToolbar}>
                  <div className={panelStyles.filterToolbarLead}>
                    <div className={panelStyles.filterToolbarHeadline}>
                      {tab === 'stock' && 'Остатки'}
                      {tab === 'receipts' && 'Приход'}
                      {tab === 'shipments' && 'Отгрузка'}
                      {tab === 'transfers' && 'Перемещения'}
                      {tab === 'inventories' && 'Инвентаризация'}
                    </div>
                  </div>

                  {tab === 'stock' && (
                    <div className={panelStyles.filterToolbarActions}>
                      <input
                        type="search"
                        value={stockWarehouseQuery}
                        onChange={(e) => setStockWarehouseQuery(e.target.value)}
                        placeholder="Поиск по названию склада"
                        className={`${formStyles.input} ${panelStyles.filterControl}`}
                        autoComplete="off"
                      />
                      <label className={panelStyles.filterCheckbox}>
                        <input type="checkbox" checked={stockOnlyPositive} onChange={(e) => setStockOnlyPositive(e.target.checked)} />
                        <span>Только с остатком</span>
                      </label>
                      <button
                        type="button"
                        className={`${formStyles.btn} ${formStyles.btnSecondary} ${panelStyles.filterGhostBtn}`}
                        onClick={() => {
                          setStockWarehouseQuery('')
                          setStockOnlyPositive(false)
                        }}
                      >
                        Сброс
                      </button>
                    </div>
                  )}

                  {(tab === 'receipts' || tab === 'shipments' || tab === 'transfers' || tab === 'inventories') && (
                    <div key={tab} className={`${panelStyles.filterToolbarActions} ${panelStyles.filterDocToolbar}`}>
                      <input
                        type="search"
                        value={docSearch[tab]}
                        onChange={(e) => setDocSearchField(tab, e.target.value)}
                        placeholder={docSearchPlaceholders[tab]}
                        title={docSearchPlaceholders[tab]}
                        className={`${formStyles.input} ${panelStyles.filterControl} ${panelStyles.filterDocSearch}`}
                        autoComplete="off"
                        aria-label={docSearchPlaceholders[tab]}
                      />
                      <div className={panelStyles.filterDateCluster} aria-label={docDateScopeLabels[tab]}>
                        <span className={panelStyles.filterClusterLabelDoc}>{docDateScopeLabels[tab]}</span>
                        <div className={panelStyles.filterInlineField}>
                          <span className={panelStyles.filterInlineLabel}>От</span>
                          <input
                            type="date"
                            value={docFilters[tab].from}
                            onChange={(e) => setDocFilterField(tab, 'from', e.target.value)}
                            className={`${formStyles.input} ${panelStyles.filterControl}`}
                          />
                        </div>
                        <div className={panelStyles.filterInlineField}>
                          <span className={panelStyles.filterInlineLabel}>До</span>
                          <input
                            type="date"
                            value={docFilters[tab].to}
                            onChange={(e) => setDocFilterField(tab, 'to', e.target.value)}
                            className={`${formStyles.input} ${panelStyles.filterControl}`}
                          />
                        </div>
                      </div>
                      <div className={panelStyles.filterQuickRow}>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary} ${panelStyles.filterGhostBtn} ${activePreset === 1 ? panelStyles.filterGhostBtnActive : ''}`} onClick={() => applyPreset(1)}>Сегодня</button>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary} ${panelStyles.filterGhostBtn} ${activePreset === 7 ? panelStyles.filterGhostBtnActive : ''}`} onClick={() => applyPreset(7)}>7 дней</button>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary} ${panelStyles.filterGhostBtn} ${activePreset === 30 ? panelStyles.filterGhostBtnActive : ''}`} onClick={() => applyPreset(30)}>30 дней</button>
                        <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary} ${panelStyles.filterGhostBtnDanger} ${activePreset === 0 ? panelStyles.filterGhostBtnDangerActive : ''}`} onClick={() => applyPreset(0)}>Сброс</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={panelStyles.dataPanelDivider} aria-hidden />

              <div className={panelStyles.dataPanelBody}>
                {loadingHistory && <div className={panelStyles.dataPanelBlockLoading}>{t('common.loading')}</div>}

                {!loadingHistory && tab === 'stock' && (
                  <>
                    <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                      <table className={styles.table}>
                        <thead><tr><th>№</th><th>Склад</th><th>Количество</th></tr></thead>
                        <tbody>
                          {filteredBalancesByWarehouse.map((r, i) => (
                            <tr key={i}><td>{i + 1}</td><td>{r.warehouse_name}</td><td>{formatQuantity(r.quantity)}</td></tr>
                          ))}
                          {filteredBalancesByWarehouse.length === 0 && (
                            <tr><td colSpan={3} className={styles.emptyTableMsg}>{balancesByWarehouse.length === 0 ? 'Нет данных' : 'Нет строк по фильтру'}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {!loadingHistory && tab === 'receipts' && (
                  <>
                    <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                      <table className={styles.table}>
                        <thead><tr><th>№</th><th>Дата</th><th>Поставщик</th><th>Кол-во</th><th>Ячейка</th></tr></thead>
                        <tbody>
                          {receipts.map((r, i) => (
                            <tr key={i}><td>{(receiptsPage - 1) * pageSize + i + 1}</td><td>{formatDate(r.date)}</td><td>{r.supplier_name}</td><td>{formatQuantity(r.quantity)}</td><td>{r.cell_name}</td></tr>
                          ))}
                          {receipts.length === 0 && (
                            <tr><td colSpan={5} className={styles.emptyTableMsg}>Нет приходов</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.paginationDock}>
                      <PaginationBar
                        page={receiptsPage}
                        pageCount={totalPages(receiptsTotal, pageSize)}
                        total={receiptsTotal}
                        onPageChange={setReceiptsPage}
                        pageSize={pageSize}
                        onPageSizeChange={setPageSize}
                        disabled={loadingHistory}
                      />
                    </div>
                  </>
                )}

                {!loadingHistory && tab === 'shipments' && (
                  <>
                    <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                      <table className={styles.table}>
                        <thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Кол-во</th><th>Ячейка</th></tr></thead>
                        <tbody>
                          {shipments.map((r, i) => (
                            <tr key={i}><td>{(shipmentsPage - 1) * pageSize + i + 1}</td><td>{formatDate(r.date)}</td><td>{r.client_name || '—'}</td><td>{formatQuantity(r.quantity)}</td><td>{r.cell_name || '—'}</td></tr>
                          ))}
                          {shipments.length === 0 && (
                            <tr><td colSpan={5} className={styles.emptyTableMsg}>Нет отгрузок</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.paginationDock}>
                      <PaginationBar
                        page={shipmentsPage}
                        pageCount={totalPages(shipmentsTotal, pageSize)}
                        total={shipmentsTotal}
                        onPageChange={setShipmentsPage}
                        pageSize={pageSize}
                        onPageSizeChange={setPageSize}
                        disabled={loadingHistory}
                      />
                    </div>
                  </>
                )}

                {!loadingHistory && tab === 'transfers' && (
                  <>
                    <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                      <table className={styles.table}>
                        <thead><tr><th>№</th><th>Дата</th><th>Кол-во</th><th>Из → В</th><th>Комментарий</th></tr></thead>
                        <tbody>
                          {transfers.map((r, i) => (
                            <tr key={i}><td>{(transfersPage - 1) * pageSize + i + 1}</td><td>{formatDate(r.date)}</td><td>{formatQuantity(r.quantity)}</td><td>{`${r.cell_from || '—'} → ${r.cell_to || '—'}`}</td><td>{r.comment || '—'}</td></tr>
                          ))}
                          {transfers.length === 0 && (
                            <tr><td colSpan={5} className={styles.emptyTableMsg}>Нет перемещений</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.paginationDock}>
                      <PaginationBar
                        page={transfersPage}
                        pageCount={totalPages(transfersTotal, pageSize)}
                        total={transfersTotal}
                        onPageChange={setTransfersPage}
                        pageSize={pageSize}
                        onPageSizeChange={setPageSize}
                        disabled={loadingHistory}
                      />
                    </div>
                  </>
                )}

                {!loadingHistory && tab === 'inventories' && (
                  <>
                    <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
                      <table className={styles.table}>
                        <thead><tr><th>№</th><th>Дата</th><th>Склад</th><th>Δ</th><th>Факт</th></tr></thead>
                        <tbody>
                          {inventories.map((r, i) => (
                            <tr key={i}><td>{(inventoriesPage - 1) * pageSize + i + 1}</td><td>{formatDate(r.date)}</td><td>{r.warehouse_name}</td><td>{formatQuantity(r.difference)}</td><td>{formatQuantity(r.quantity_actual)}</td></tr>
                          ))}
                          {inventories.length === 0 && (
                            <tr><td colSpan={5} className={styles.emptyTableMsg}>Нет инвентаризаций</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.paginationDock}>
                      <PaginationBar
                        page={inventoriesPage}
                        pageCount={totalPages(inventoriesTotal, pageSize)}
                        total={inventoriesTotal}
                        onPageChange={setInventoriesPage}
                        pageSize={pageSize}
                        onPageSizeChange={setPageSize}
                        disabled={loadingHistory}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {photoViewerOpen ? (
            <div className={pageStyles.photoOverlay} onClick={() => !photoBusy && setPhotoViewerOpen(false)}>
              <div className={pageStyles.photoDialog} onClick={(e) => e.stopPropagation()}>
                {photoUrl(product.photo_url || product.photo) ? (
                  <img src={photoUrl(product.photo_url || product.photo)} alt="" className={pageStyles.photoDialogImg} />
                ) : (
                  <div className={pageStyles.photoDialogEmpty}>Фото отсутствует</div>
                )}
                <div className={pageStyles.photoDialogActions}>
                  <label className={`${formStyles.btn} ${formStyles.btnSecondary}`}>
                    Изменить фото
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={photoBusy}
                      onChange={(e) => onPhotoChange(e.target.files?.[0])}
                    />
                  </label>
                  <button type="button" className={`${formStyles.btn} ${formStyles.btnDanger}`} disabled={photoBusy} onClick={onPhotoDelete}>
                    Удалить фото
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

