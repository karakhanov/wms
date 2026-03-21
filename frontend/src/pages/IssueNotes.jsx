import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { construction, orders as ordersApi, products, stock as stockApi, users as usersApi } from '../api'
import { useAuth } from '../auth'
import { canApproveIssueNotes, canCreateIssueNotes, canViewIssueNotes } from '../permissions'
import Modal from '../components/Modal'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import StatusBadge from '../components/StatusBadge'
import toolbarStyles from '../components/TableToolbar.module.css'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import PaginationBar from '../components/PaginationBar'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import { issueNoteStatusLabel } from '../utils/statusLabel'
import tableStyles from './Table.module.css'
import formStyles from './Form.module.css'
import styles from './IssueNotes.module.css'

export default function IssueNotes() {
  const fmtQty = (v) => {
    const n = Number(v || 0)
    if (!Number.isFinite(n)) return '0'
    return n.toFixed(3).replace(/\.?0+$/, '')
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const canView = canViewIssueNotes(user)
  const canCreate = canCreateIssueNotes(user)
  const canApprove = canApproveIssueNotes(user)
  const [rows, setRows] = useState([])
  const [objects, setObjects] = useState([])
  const [categories, setCategories] = useState([])
  const [productRows, setProductRows] = useState([])
  const [managers, setManagers] = useState([])
  const [autoNumber, setAutoNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [objectFilter, setObjectFilter] = useState('')
  const [shortageFilter, setShortageFilter] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [selectedNote, setSelectedNote] = useState(null)
  const [stockByProduct, setStockByProduct] = useState({})
  const [noteShortageById, setNoteShortageById] = useState({})
  const [noteHoverInfoById, setNoteHoverInfoById] = useState({})
  const [hoverTooltip, setHoverTooltip] = useState({ visible: false, x: 0, y: 0, type: 'shortage', items: [] })
  const openNoteId = searchParams.get('openNote')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [form, setForm] = useState({
    construction_object: '',
    recipient_id: '',
    comment: '',
  })
  const assignedObjectFallback = useMemo(() => {
    const ids = Array.isArray(user?.assigned_objects) ? user.assigned_objects : []
    const names = Array.isArray(user?.assigned_object_names) ? user.assigned_object_names : []
    return ids.map((id, idx) => ({ id, name: names[idx] || `#${id}` }))
  }, [user])
  const objectOptions = objects.length ? objects : assignedObjectFallback
  const categoryOptions = useMemo(() => {
    if (categories.length) return categories
    const seen = new Map()
    for (const p of productRows) {
      if (!p?.category) continue
      if (!seen.has(String(p.category))) {
        seen.set(String(p.category), { id: p.category, name: p.category_name || `#${p.category}` })
      }
    }
    return Array.from(seen.values())
  }, [categories, productRows])

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([
      ordersApi.issueNotes({ page_size: 200 }),
      construction.objects({ page_size: 200 }),
      products.categories({ page_size: 500 }),
      products.list({ page_size: 500 }),
      usersApi.managers(),
      ordersApi.issueNoteNextNumber(),
    ])
      .then(([inRes, objRes, catRes, productRes, managersRes, nextNumRes]) => {
        setRows(inRes.status === 'fulfilled' ? normalizeListResponse(inRes.value).results || [] : [])
        setObjects(objRes.status === 'fulfilled' ? normalizeListResponse(objRes.value).results || [] : [])
        setCategories(catRes.status === 'fulfilled' ? normalizeListResponse(catRes.value).results || [] : [])
        setProductRows(productRes.status === 'fulfilled' ? normalizeListResponse(productRes.value).results || [] : [])
        const mgrs = managersRes.status === 'fulfilled' ? managersRes.value || [] : []
        setManagers(mgrs)
        setAutoNumber(nextNumRes.status === 'fulfilled' ? (nextNumRes.value?.number || '') : '')
        setForm((prev) => ({
          ...prev,
          recipient_id: prev.recipient_id || (mgrs[0] ? String(mgrs[0].id) : ''),
        }))
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let alive = true
    const calculateShortages = async () => {
      const rowsWithItems = rows.filter((n) => (n?.items || []).length > 0)
      if (!rowsWithItems.length) {
        if (alive) setNoteShortageById({})
        if (alive) setNoteHoverInfoById({})
        return
      }
      const allItems = rowsWithItems.flatMap((n) => n?.items || [])
      const productIds = Array.from(new Set(allItems.map((it) => Number(it?.product)).filter((v) => Number.isFinite(v) && v > 0)))
      if (!productIds.length) {
        if (alive) setNoteShortageById({})
        if (alive) setNoteHoverInfoById({})
        return
      }
      try {
        const responses = await Promise.all(productIds.map((productId) => stockApi.balances({ page_size: 2000, product: productId })))
        const totals = {}
        const warehouseMap = {}
        productIds.forEach((pid, idx) => {
          const balances = normalizeListResponse(responses[idx]).results || []
          totals[String(pid)] = balances.reduce((sum, b) => sum + Number(b.quantity || 0), 0)
          const wh = new Map()
          balances.forEach((b) => {
            const wName = b.warehouse_name || t('common.none')
            wh.set(wName, (wh.get(wName) || 0) + Number(b.quantity || 0))
          })
          warehouseMap[String(pid)] = Array.from(wh.entries()).map(([name, qty]) => `${name}: ${fmtQty(qty)}`)
        })
        const next = {}
        const hoverInfo = {}
        rowsWithItems.forEach((note) => {
          const shortages = (note?.items || []).map((it) => {
            const need = Number(it?.quantity || 0)
            const total = Number(totals[String(it?.product)] || 0)
            return need > total
          })
          next[String(note.id)] = shortages.some(Boolean)
          const itemLines = (note?.items || []).map((it) => {
            const pid = String(it?.product || '')
            const need = Number(it?.quantity || 0)
            const total = Number(totals[pid] || 0)
            const lack = Math.max(0, need - total)
            const label = `${it?.product_sku ? `${it.product_sku} - ` : ''}${it?.product_name || t('common.none')}`
            const warehouses = warehouseMap[pid]?.length ? warehouseMap[pid].join(', ') : t('common.none')
            return {
              shortage: lack > 0,
              productLabel: label,
              need: fmtQty(need),
              total: fmtQty(total),
              lack: fmtQty(lack),
              warehouses,
            }
          })
          const shortageItems = itemLines.filter((x) => x.shortage)
          hoverInfo[String(note.id)] = {
            shortageItems,
            productItems: itemLines,
          }
        })
        if (alive) {
          setNoteShortageById(next)
          setNoteHoverInfoById(hoverInfo)
        }
      } catch {
        if (alive) setNoteShortageById({})
        if (alive) setNoteHoverInfoById({})
      }
    }
    calculateShortages()
    return () => {
      alive = false
    }
  }, [rows])

  const [items, setItems] = useState([{ category: '', product: '', quantity: '', comment: '' }])

  const onCreate = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.recipient_id || !form.construction_object) {
      setError(t('issueNotes.validation'))
      return
    }
    setSaving(true)
    try {
      const payloadItems = items
        .map((it) => {
          const qty = Number(it.quantity)
          const pid = Number(it.product)
          if (!pid || !qty || qty <= 0) return null
          return {
            product: pid,
            quantity: qty.toFixed(3),
            comment: (it.comment || '').trim(),
          }
        })
        .filter(Boolean)

      if (!payloadItems.length) {
        setError(t('issueNotes.validation'))
        setSaving(false)
        return
      }

      const selectedManager = managers.find((m) => String(m.id) === String(form.recipient_id))
      await ordersApi.issueNoteCreate({
        construction_object: Number(form.construction_object),
        recipient_name: selectedManager?.display_name || selectedManager?.username || '',
        comment: form.comment.trim(),
        items: payloadItems,
      })
      setForm({ construction_object: '', recipient_id: managers[0] ? String(managers[0].id) : '', comment: '' })
      setItems([{ category: '', product: '', quantity: '', comment: '' }])
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    } finally {
      setSaving(false)
    }
  }

  const askRejectComment = () => {
    const value = window.prompt(t('issueNotes.rejectCommentPrompt'), '')
    if (value === null) return null
    const trimmed = String(value || '').trim()
    if (!trimmed) {
      setError(t('issueNotes.rejectCommentRequired'))
      return null
    }
    return trimmed
  }

  const onApprove = async (id, status, rejectionComment = '') => {
    try {
      const payload = { status }
      if (status === 'rejected') payload.rejection_comment = rejectionComment
      await ordersApi.issueNoteUpdate(id, payload)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const openDetailsById = async (id, fallbackRow = null) => {
    setError('')
    setDetailsOpen(true)
    setSelectedNote(fallbackRow)
    setDetailsLoading(true)
    try {
      const full = await ordersApi.issueNoteGet(id)
      setSelectedNote(full || fallbackRow)
      await loadStockForNote(full || fallbackRow)
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.detailsLoadError'))
      setSelectedNote(fallbackRow)
    } finally {
      setDetailsLoading(false)
    }
  }

  const openDetails = async (row) => openDetailsById(row.id, row)

  const openShortageTooltip = (event, items) => {
    if (!items?.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(720, Math.max(340, window.innerWidth * 0.75))
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - width - 12))
    const y = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 240))
    setHoverTooltip({ visible: true, x, y, type: 'shortage', items })
  }

  const openProductsTooltip = (event, items) => {
    if (!items?.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(760, Math.max(360, window.innerWidth * 0.78))
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - width - 12))
    const y = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 260))
    setHoverTooltip({ visible: true, x, y, type: 'products', text: '', items })
  }

  const closeTooltip = () => setHoverTooltip((prev) => ({ ...prev, visible: false }))

  const moveTooltipNearCursor = (event) => {
    const width = hoverTooltip.type === 'products' ? 760 : 720
    const x = Math.max(8, Math.min(event.clientX + 14, window.innerWidth - width - 12))
    const y = Math.max(8, Math.min(event.clientY + 16, window.innerHeight - 260))
    setHoverTooltip((prev) => ({ ...prev, x, y }))
  }

  useEffect(() => {
    if (!canView) return
    if (!openNoteId) return
    const id = Number(openNoteId)
    if (!id || Number.isNaN(id)) return
    openDetailsById(id)
      .finally(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('openNote')
        setSearchParams(next, { replace: true })
      })
  }, [canView, openNoteId, searchParams, setSearchParams])

  const closeDetails = () => {
    setDetailsOpen(false)
    setSelectedNote(null)
    setStockByProduct({})
  }

  const loadStockForNote = async (note) => {
    const items = note?.items || []
    const productIds = Array.from(new Set(items.map((it) => Number(it?.product)).filter((v) => Number.isFinite(v) && v > 0)))
    if (!productIds.length) {
      setStockByProduct({})
      return
    }
    setStockLoading(true)
    try {
      const responses = await Promise.all(productIds.map((productId) => stockApi.balances({ page_size: 2000, product: productId })))
      const nextMap = {}
      productIds.forEach((productId, idx) => {
        const balances = normalizeListResponse(responses[idx]).results || []
        let total = 0
        const byWarehouse = new Map()
        balances.forEach((b) => {
          const qty = Number(b.quantity || 0)
          total += qty
          const wh = b.warehouse_name || t('common.none')
          byWarehouse.set(wh, (byWarehouse.get(wh) || 0) + qty)
        })
        nextMap[String(productId)] = {
          total,
          byWarehouse: Array.from(byWarehouse.entries()).map(([warehouse, qty]) => ({ warehouse, qty })),
        }
      })
      setStockByProduct(nextMap)
    } catch {
      setStockByProduct({})
    } finally {
      setStockLoading(false)
    }
  }

  const onApproveFromDetails = async (status) => {
    if (!selectedNote?.id) return
    let rejectionComment = ''
    if (status === 'rejected') {
      const picked = askRejectComment()
      if (!picked) return
      rejectionComment = picked
    }
    await onApprove(selectedNote.id, status, rejectionComment)
    setSelectedNote((prev) =>
      prev
        ? {
            ...prev,
            status,
            rejection_comment: status === 'rejected' ? rejectionComment : (prev.rejection_comment || ''),
            status_display:
              status === 'approved'
                ? t('issueNotes.approvedStatusLabel')
                : status === 'rejected'
                  ? t('issueNotes.rejectedStatusLabel')
                  : prev.status_display,
          }
        : prev
    )
    closeDetails()
  }

  const noteItems = selectedNote?.items || []
  const stockRowsForSelected = useMemo(
    () =>
      noteItems.map((it, idx) => {
        const stockInfo = stockByProduct[String(it.product)] || { total: 0, byWarehouse: [] }
        const need = Number(it.quantity || 0)
        const total = Number(stockInfo.total || 0)
        const shortage = Math.max(0, need - total)
        return {
          key: it.id || idx,
          productLabel: `${it.product_sku ? `${it.product_sku} - ` : ''}${it.product_name || t('common.none')}`,
          need,
          total,
          shortage,
          byWarehouse: stockInfo.byWarehouse || [],
        }
      }),
    [noteItems, stockByProduct, t]
  )

  const senderName = (note) =>
    note?.created_by_full_name ||
    note?.created_by_name ||
    note?.created_by_username ||
    note?.created_by ||
    t('common.none')

  const categoryText = (note) =>
    Array.from(
      new Set(
        (note?.items || [])
          .map((it) => (it?.category_name || it?.product_category_name || '').trim())
          .filter(Boolean)
      )
    ).join(', ') || t('common.none')

  const productsText = (note) =>
    (note?.items || [])
      .map((it) => `${it?.product_sku ? `${it.product_sku} - ` : ''}${it?.product_name || ''}`.trim())
      .filter(Boolean)
      .join(', ') || t('common.none')

  const noteStatusText = (note) => issueNoteStatusLabel(t, note?.status, note?.status_display || note?.status || '')

  const filteredRows = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase()
    return rows.filter((n) => {
      if (statusFilter && String(n.status) !== String(statusFilter)) return false
      if (objectFilter && String(n.construction_object || '') !== String(objectFilter)) return false
      if (shortageFilter === 'with' && !noteShortageById[String(n.id)]) return false
      if (shortageFilter === 'without' && noteShortageById[String(n.id)]) return false
      if (!inDateRange(n.created_at, datePreset, dateFrom, dateTo)) return false
      if (!q) return true
      const haystack = [
        n.id,
        n.number,
        n.construction_object_name,
        senderName(n),
        noteStatusText(n),
        categoryText(n),
        productsText(n),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, debouncedSearch, statusFilter, objectFilter, shortageFilter, noteShortageById, datePreset, dateFrom, dateTo])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    const factor = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const value = (row) => {
        if (sortKey === 'id') return Number(row.id || 0)
        if (sortKey === 'number') return String(row.number || '')
        if (sortKey === 'object') return String(row.construction_object_name || '')
        if (sortKey === 'categories') return categoryText(row)
        if (sortKey === 'products') return productsText(row)
        if (sortKey === 'sender') return senderName(row)
        if (sortKey === 'status') return String(noteStatusText(row))
        if (sortKey === 'created_at') return Date.parse(row.created_at || '') || 0
        return ''
      }
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [filteredRows, sortKey, sortDir])

  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState(DEFAULT_PAGE_SIZE)

  const pagedSortedRows = useMemo(() => {
    const start = (listPage - 1) * listPageSize
    return sortedRows.slice(start, start + listPageSize)
  }, [sortedRows, listPage, listPageSize])

  useEffect(() => {
    setListPage(1)
  }, [debouncedSearch, statusFilter, objectFilter, shortageFilter, datePreset, dateFrom, dateTo, sortKey, sortDir])

  const listPages = totalPages(sortedRows.length, listPageSize)

  const toggleSort = (nextKey) => {
    setListPage(1)
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDir('asc')
  }


  const objectFilterOptions = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      if (!r?.construction_object) return
      if (!map.has(String(r.construction_object))) {
        map.set(String(r.construction_object), {
          id: String(r.construction_object),
          name: r.construction_object_name || `#${r.construction_object}`,
        })
      }
    })
    return Array.from(map.values())
  }, [rows])

  const statusOptions = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      if (!r?.status) return
      map.set(String(r.status), issueNoteStatusLabel(t, r.status, r.status_display || r.status))
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rows, t])

  const exportCsv = () => {
    downloadCsv(
      `issue-notes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        t('issueNotes.id'),
        t('issueNotes.number'),
        t('issueNotes.object'),
        t('issueNotes.categories'),
        t('issueNotes.products'),
        t('issueNotes.sender'),
        t('issueNotes.status'),
        t('issueNotes.date'),
      ],
      sortedRows.map((n) => [
        n.id,
        n.number,
        n.construction_object_name || t('common.none'),
        categoryText(n),
        productsText(n),
        senderName(n),
        noteStatusText(n),
        n.created_at?.slice(0, 10),
      ])
    )
  }

  return (
    <div className={tableStyles.page}>
      {canCreate && (
        <Modal open={formOpen} title={t('issueNotes.create')} onClose={() => setFormOpen(false)} xwide>
          <form className={`${formStyles.form} ${formStyles.formModal}`} onSubmit={onCreate}>
            <div className={formStyles.row}>
              <label>{t('issueNotes.number')}</label>
              <input
                className={formStyles.input}
                value={autoNumber || t('common.loading')}
                readOnly
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('issueNotes.object')}</label>
              <select
                className={formStyles.select}
                value={form.construction_object}
                onChange={(e) => setForm((v) => ({ ...v, construction_object: e.target.value }))}
              >
                <option value="">{t('common.none')}</option>
                {objectOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={formStyles.row}>
              <label>{t('issueNotes.recipient')}</label>
              <select
                className={formStyles.select}
                value={form.recipient_id}
                onChange={(e) => setForm((v) => ({ ...v, recipient_id: e.target.value }))}
              >
                <option value="">{t('common.none')}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className={formStyles.row}>
              <label>{t('issueNotes.items')}</label>
              <div className={styles.itemsWrap}>
                {items.map((it, idx) => (
                  <div key={idx} className={styles.itemCard}>
                    <div className={styles.itemGrid}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>{t('products.category')}</label>
                        <select
                          className={formStyles.select}
                          value={it.category}
                          onChange={(e) => {
                            const value = e.target.value
                            setItems((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, category: value, product: '' } : x))
                            )
                          }}
                        >
                          <option value="">{t('common.none')}</option>
                          {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>{t('issueNotes.product')}</label>
                        <select
                          className={formStyles.select}
                          value={it.product}
                          onChange={(e) => {
                            const value = e.target.value
                            setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, product: value } : x)))
                          }}
                        >
                          <option value="">{t('common.none')}</option>
                          {productRows
                            .filter((p) => !it.category || String(p.category) === String(it.category))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.sku} - {p.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>{t('products.unit')}</label>
                        <input
                          className={formStyles.input}
                          value={productRows.find((p) => String(p.id) === String(it.product))?.unit || t('common.none')}
                          readOnly
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>{t('issueNotes.qty')}</label>
                        <input
                          className={formStyles.input}
                          type="number"
                          min="0"
                          step="0.001"
                          value={it.quantity}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                          }
                        />
                      </div>
                      <div className={styles.fieldActions}>
                        <button
                          className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                          type="button"
                          onClick={() =>
                            setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
                          }
                          disabled={items.length <= 1}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                    <div className={styles.itemComment}>
                      <label className={styles.fieldLabel}>{t('products.description')}</label>
                      <input
                        className={formStyles.input}
                        value={it.comment || ''}
                        onChange={(e) =>
                          setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={formStyles.actions}>
                <button
                  className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                  type="button"
                  onClick={() => setItems((prev) => [...prev, { category: '', product: '', quantity: '', comment: '' }])}
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
            <div className={formStyles.row}>
              <label>{t('products.description')}</label>
              <input
                className={formStyles.input}
                value={form.comment}
                onChange={(e) => setForm((v) => ({ ...v, comment: e.target.value }))}
              />
            </div>
            {error ? <div className={formStyles.error}>{error}</div> : null}
            <div className={formStyles.actions}>
              <button className={`${formStyles.btn} ${formStyles.btnPrimary}`} type="submit" disabled={saving}>
                {saving ? t('common.loading') : t('common.send')}
              </button>
              <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={() => setFormOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <Modal open={detailsOpen} title={t('issueNotes.detailsTitle')} onClose={closeDetails} xwide>
        {detailsLoading ? (
          <div>{t('common.loading')}</div>
        ) : !selectedNote ? (
          <div>{t('common.none')}</div>
        ) : (
          <div className={styles.detailsWrap}>
            <div className={styles.detailsGrid}>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.number')}</div>
                <div>{selectedNote.number || t('common.none')}</div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.object')}</div>
                <div>{selectedNote.construction_object_name || selectedNote.request || t('common.none')}</div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.sender')}</div>
                <div>{senderName(selectedNote)}</div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.recipient')}</div>
                <div>{selectedNote.recipient_name || t('common.none')}</div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.status')}</div>
                <div>
                  <StatusBadge value={noteStatusText(selectedNote)} toneValue={selectedNote.status} />
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t('issueNotes.date')}</div>
                <div>{selectedNote.created_at?.slice(0, 10) || t('common.none')}</div>
              </div>
            </div>

            {selectedNote.comment ? (
              <div className={styles.detailsComment}>
                <div className={styles.fieldLabel}>{t('products.description')}</div>
                <div>{selectedNote.comment}</div>
              </div>
            ) : null}
            {selectedNote.status === 'rejected' && selectedNote.rejection_comment ? (
              <div className={styles.detailsComment}>
                <div className={styles.fieldLabel}>{t('issueNotes.rejectCommentLabel')}</div>
                <div>{selectedNote.rejection_comment}</div>
              </div>
            ) : null}

            <div className={styles.detailItemsTableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>{t('products.category')}</th>
                    <th>{t('issueNotes.product')}</th>
                    <th>{t('products.unit')}</th>
                    <th>{t('issueNotes.qty')}</th>
                    <th>{t('products.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {noteItems.length ? (
                    noteItems.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>{it.category_name || it.product_category_name || t('common.none')}</td>
                        <td>{`${it.product_sku ? `${it.product_sku} - ` : ''}${it.product_name || t('common.none')}`}</td>
                        <td>{it.product_unit || it.unit || t('common.none')}</td>
                        <td>{it.quantity}</td>
                        <td>{it.comment || t('common.none')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>{t('common.none')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.stockSection}>
              <div className={styles.fieldLabel}>{t('issueNotes.stockSectionTitle')}</div>
              {stockLoading ? (
                <div>{t('common.loading')}</div>
              ) : !stockRowsForSelected.length ? (
                <div>{t('common.none')}</div>
              ) : (
                <div className={styles.stockCards}>
                  {stockRowsForSelected.map((row) => (
                    <div key={row.key} className={`${styles.stockCard} ${row.shortage > 0 ? styles.stockCardShortage : ''}`}>
                      <div className={styles.stockCardTitle}>{row.productLabel}</div>
                      <div className={styles.stockLine}>
                        <span>{t('issueNotes.qty')}:</span> <b>{row.need.toFixed(3)}</b>
                      </div>
                      <div className={styles.stockLine}>
                        <span>{t('issueNotes.stockTotal')}:</span> <b>{row.total.toFixed(3)}</b>
                      </div>
                      <div className={`${styles.stockLine} ${row.shortage > 0 ? styles.stockDanger : ''}`}>
                        <span>{t('issueNotes.shortageQty')}:</span> <b>{row.shortage.toFixed(3)}</b>
                      </div>
                      <div className={styles.stockWarehouses}>
                        {row.byWarehouse.length
                          ? row.byWarehouse.map((w) => `${w.warehouse}: ${Number(w.qty || 0).toFixed(3)}`).join(', ')
                          : t('common.none')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canApprove ? (
              <div className={formStyles.actions}>
                {selectedNote.status === 'submitted' ? (
                  <>
                    <button
                      type="button"
                      className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                      onClick={() => onApproveFromDetails('approved')}
                    >
                      {t('issueNotes.approve')}
                    </button>
                    <button
                      type="button"
                      className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                      onClick={() => onApproveFromDetails('rejected')}
                    >
                      {t('issueNotes.reject')}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <div className={tableStyles.pageHead}>
        <div>
          <h1 className={tableStyles.h1}>{t('issueNotes.title')}</h1>
        </div>
        {canCreate && (
          <button type="button" className={tableStyles.btnAdd} onClick={() => setFormOpen(true)}>
            {t('common.add')}
          </button>
        )}
      </div>
      {error ? <div className={formStyles.error}>{error}</div> : null}

      {!canView ? (
        <div>{t('issueNotes.noAccess')}</div>
      ) : loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            onExport={exportCsv}
            exportDisabled={!sortedRows.length}
          >
            <select className={toolbarStyles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('issueNotes.status')}</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className={toolbarStyles.filterSelect} value={objectFilter} onChange={(e) => setObjectFilter(e.target.value)}>
              <option value="">{t('issueNotes.object')}</option>
              {objectFilterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select className={toolbarStyles.filterSelect} value={shortageFilter} onChange={(e) => setShortageFilter(e.target.value)}>
              <option value="">{t('issueNotes.shortageFilterAll')}</option>
              <option value="with">{t('issueNotes.shortageFilterWith')}</option>
              <option value="without">{t('issueNotes.shortageFilterWithout')}</option>
            </select>
            <select className={toolbarStyles.filterSelect} value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
              <option value="">{t('common.allTime')}</option>
              <option value="today">{t('common.today')}</option>
              <option value="week">{t('common.thisWeek')}</option>
              <option value="month">{t('common.thisMonth')}</option>
              <option value="custom">{t('common.customRange')}</option>
            </select>
            {datePreset === 'custom' ? (
              <>
                <input
                  className={toolbarStyles.filterSelect}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label={t('common.dateFrom')}
                />
                <input
                  className={toolbarStyles.filterSelect}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label={t('common.dateTo')}
                />
              </>
            ) : null}
          </TableToolbar>
          <div className={tableStyles.pageBody}>
          <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.number')} sortKey="number" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.object')} sortKey="object" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.categories')} sortKey="categories" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.products')} sortKey="products" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.sender')} sortKey="sender" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.status')} sortKey="status" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader className={styles.sortableHeader} label={t('issueNotes.date')} sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {canApprove ? <th>{t('common.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pagedSortedRows.map((n) => (
                <tr
                  key={n.id}
                  className={`${styles.clickableRow} ${noteShortageById[String(n.id)] ? styles.shortageRow : ''}`}
                  onClick={() => openDetails(n)}
                  onMouseEnter={(e) => {
                    if (!noteShortageById[String(n.id)]) return
                    openShortageTooltip(e, noteHoverInfoById[String(n.id)]?.shortageItems || [])
                  }}
                  onMouseMove={(e) => {
                    if (!noteShortageById[String(n.id)] || !hoverTooltip.visible || hoverTooltip.type !== 'shortage') return
                    moveTooltipNearCursor(e)
                  }}
                  onMouseLeave={closeTooltip}
                >
                  <td>
                    <div className={styles.rowShortageAnchor}>
                      <span>{n.id}</span>
                    </div>
                  </td>
                  <td>{n.number}</td>
                  <td>{n.construction_object_name || n.request || t('common.none')}</td>
                  <td>{categoryText(n)}</td>
                  <td>
                    <div
                      className={styles.productsCell}
                      onMouseEnter={(e) => openProductsTooltip(e, noteHoverInfoById[String(n.id)]?.productItems || [])}
                      onMouseLeave={closeTooltip}
                    >
                      <span>{productsText(n)}</span>
                    </div>
                  </td>
                  <td>{senderName(n)}</td>
                  <td>
                    <StatusBadge value={noteStatusText(n)} toneValue={n.status} />
                  </td>
                  <td>{n.created_at?.slice(0, 10)}</td>
                  {canApprove ? (
                    <td>
                      {n.status === 'submitted' ? (
                        <>
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onApprove(n.id, 'approved')
                            }}
                          >
                            {t('issueNotes.approve')}
                          </button>{' '}
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              const rejectionComment = askRejectComment()
                              if (!rejectionComment) return
                              onApprove(n.id, 'rejected', rejectionComment)
                            }}
                          >
                            {t('issueNotes.reject')}
                          </button>
                        </>
                      ) : (
                        t('common.none')
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className={tableStyles.paginationDock}>
            <PaginationBar
              page={listPage}
              pageCount={listPages}
              total={sortedRows.length}
              onPageChange={setListPage}
              pageSize={listPageSize}
              onPageSizeChange={(size) => {
                setListPageSize(size)
                setListPage(1)
              }}
              disabled={loading}
            />
          </div>
          </div>
        </div>
      )}
      {hoverTooltip.visible ? (
        <div
          className={`${styles.floatingTooltip} ${hoverTooltip.type === 'products' ? styles.floatingTooltipProducts : styles.floatingTooltipShortage}`}
          style={{ left: `${hoverTooltip.x}px`, top: `${hoverTooltip.y}px` }}
        >
          <div className={styles.tooltipHead}>
            {hoverTooltip.type === 'products' ? t('issueNotes.stockSectionTitle') : t('issueNotes.hoverShortageTitle')}
          </div>
          {hoverTooltip.items.map((item, idx) => (
            <div key={idx} className={styles.productsTooltipItem}>
              <div className={styles.productsTooltipTitle}>{item.productLabel}</div>
              <div className={styles.productsTooltipRow}>
                <span className={styles.productsTooltipKey}>{t('issueNotes.stockTotal')}</span>
                <span className={styles.productsTooltipVal}>{item.total}</span>
              </div>
              {hoverTooltip.type === 'shortage' ? (
                <div className={styles.productsTooltipRow}>
                  <span className={styles.productsTooltipKey}>{t('issueNotes.shortageQty')}</span>
                  <span className={styles.productsTooltipDanger}>{item.lack}</span>
                </div>
              ) : null}
              <div className={styles.productsTooltipWarehouses}>{item.warehouses}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
