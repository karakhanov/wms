import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  construction,
  orders as ordersApi,
  products,
  stock as stockApi,
  suppliers as suppliersApi,
  users as usersApi,
  warehouse as warehouseApi,
} from '../api'
import { useAuth } from '../auth'
import {
  canApproveIssueNotes,
  canControllerIssueNote,
  canCreateIssueNotes,
  canForemanConfirmIssueNote,
  canForemanConfirmIssueReceipt,
  canProcurementIssueNote,
  canSendIssueNoteToProcurement,
  canShowIssueNoteApproveButton,
  issueNoteApproveBlockedByShortage,
  canStorekeeperIssueNoteFlow,
  canUserInspectIssueNote,
  canViewIssueNotes,
  canViewIssueNoteShortageHints,
  isForeman,
} from '../permissions'
import Modal from '../components/Modal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import StatusBadge from '../components/StatusBadge'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect, ToolbarFilterDateInput } from '../components/ToolbarControls'
import { downloadCsv } from '../utils/csvExport'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import PaginationBar from '../components/PaginationBar'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { formatQuantity } from '../utils/formatQuantity'
import { effectiveIssueLineQty } from '../utils/issueNoteLineQty'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { inDateRange } from '../utils/dateFilter'
import { issueNoteStatusLabel } from '../utils/statusLabel'
import { IconChevronDown } from '../ui/Icons'
import tableStyles from './Table.module.css'
import panelStyles from './DataPanelLayout.module.css'
import formStyles from './Form.module.css'
import styles from './IssueNotes.module.css'

function formatApiErrorDetail(data) {
  if (!data || typeof data !== 'object') return ''
  const d = data.detail
  if (typeof d === 'string' && d.trim()) return d.trim()
  if (Array.isArray(d)) {
    const s = d
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') return [x.string, x.message].filter(Boolean).join(' ') || ''
        return String(x)
      })
      .filter(Boolean)
      .join(' ')
      .trim()
    if (s) return s
  }
  const parts = []
  for (const [k, v] of Object.entries(data)) {
    if (k === 'detail') continue
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string' && x.trim()) parts.push(x.trim())
      }
    }
  }
  return parts.join(' ').trim()
}

function formatSupplierComboLabel(s) {
  if (!s) return ''
  const base = (s.name || `#${s.id}`).trim()
  return s.inn ? `${base} · ${s.inn}` : base
}

function issueLineLabel(it, t) {
  if (!it) return t('common.none')
  if (it.service || it.service_name || it.service_code) {
    return `${it.service_code ? `${it.service_code} - ` : ''}${it.service_name || t('common.none')}`
  }
  return `${it.product_sku ? `${it.product_sku} - ` : ''}${it.product_name || t('common.none')}`
}

function isServiceLine(it) {
  return Boolean(it?.service || it?.service_name || it?.service_code)
}

function computeDefaultProcurementItemIds(note, itemShortageByItemId) {
  const items = note?.items || []
  if (!items.length) return []
  if (items.length === 1) return [items[0].id]
  const pids = new Set(items.map((i) => Number(i.product)))
  if (pids.size === 1) return items.map((i) => i.id)
  const short = itemShortageByItemId || {}
  const shortPids = new Set()
  for (const it of items) {
    if (it.id && short[String(it.id)]) shortPids.add(Number(it.product))
  }
  if (shortPids.size === 1) {
    const pid = [...shortPids][0]
    return items.filter((i) => Number(i.product) === pid).map((i) => i.id)
  }
  return null
}

export default function IssueNotes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const canView = canViewIssueNotes(user)
  const canCreate = canCreateIssueNotes(user)
  const canApprove = canApproveIssueNotes(user)
  const canSendProcurement = canSendIssueNoteToProcurement(user)
  const canProcurement = canProcurementIssueNote(user)
  const canController = canControllerIssueNote(user)
  const canStorekeeperFlow = canStorekeeperIssueNoteFlow(user)
  const canForemanRole = canForemanConfirmIssueReceipt(user)
  const canSeeShortageHints = canViewIssueNoteShortageHints(user)
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
  const [detailsCardsOpen, setDetailsCardsOpen] = useState({
    procurementNotes: true,
    procurementReadonly: true,
    procurementForm: true,
  })
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
  const [items, setItems] = useState([{ kind: 'product', category: '', product: '', service: '', quantity: '', comment: '' }])
  const [serviceRows, setServiceRows] = useState([])
  const [controllerLines, setControllerLines] = useState([])
  const [controllers, setControllers] = useState([])
  const [assignControllerIds, setAssignControllerIds] = useState([])
  const [procurementCommentModal, setProcurementCommentModal] = useState({ open: false, noteId: null, text: '' })
  const [supplierRows, setSupplierRows] = useState([])
  const [procurementItemIds, setProcurementItemIds] = useState([])
  const [supplierQuickModal, setSupplierQuickModal] = useState({ open: false, name: '', inn: '', contact: '' })
  const [supplierComboText, setSupplierComboText] = useState('')
  const [supplierComboOpen, setSupplierComboOpen] = useState(false)
  const supplierComboRef = useRef(null)
  const [placementWarehouses, setPlacementWarehouses] = useState([])
  const [placementZonesByWh, setPlacementZonesByWh] = useState({})

  const ensurePlacementZones = useCallback((whId) => {
    const wid = String(whId || '')
    if (!wid) return Promise.resolve()
    return warehouseApi.zones({ warehouse: wid, page_size: 500 }).then((d) => {
      const list = normalizeListResponse(d).results || []
      setPlacementZonesByWh((prev) => ({ ...prev, [wid]: list }))
    })
  }, [])
  const [procurementForm, setProcurementForm] = useState({
    procurement_purchase_date: '',
    procurement_amount: '',
    procurement_quantity_note: '',
    procurement_supplier: '',
    procurement_vehicle: '',
    procurement_delivery_notes: '',
    procurement_scan: null,
  })
  const [quickAssignModal, setQuickAssignModal] = useState({ open: false, note: null })
  const [quickAssignIds, setQuickAssignIds] = useState([])

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

  const suppliersComboFiltered = useMemo(() => {
    const q = supplierComboText.trim().toLowerCase()
    const match = (s) => {
      if (!q) return true
      return [s.name, s.inn, s.contact].some((x) => String(x || '').toLowerCase().includes(q))
    }
    let list = supplierRows.filter(match)
    const sel = procurementForm.procurement_supplier
    if (sel) {
      const cur = supplierRows.find((x) => String(x.id) === String(sel))
      if (cur && !list.some((x) => x.id === cur.id)) list = [cur, ...list]
    }
    return list.slice(0, 120)
  }, [supplierRows, supplierComboText, procurementForm.procurement_supplier])

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([
      ordersApi.issueNotes({ page_size: 200 }),
      construction.objects({ page_size: 200 }),
      products.categories({ page_size: 500 }),
      products.list({ page_size: 500 }),
      products.services({ page_size: 500 }),
      usersApi.managers(),
      usersApi.controllers(),
      suppliersApi.list({ page_size: 500 }),
      ordersApi.issueNoteNextNumber(),
    ])
      .then(([inRes, objRes, catRes, productRes, serviceRes, managersRes, controllersRes, supRes, nextNumRes]) => {
        if (inRes.status === 'rejected') {
          const d = inRes.reason?.response?.data
          const detail = d?.detail
          const msg =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((x) => (typeof x === 'string' ? x : x?.message || String(x))).join(' ')
                : t('issueNotes.listLoadError')
          setError(msg)
          setRows([])
        } else {
          setRows(normalizeListResponse(inRes.value).results || [])
        }
        setObjects(objRes.status === 'fulfilled' ? normalizeListResponse(objRes.value).results || [] : [])
        setCategories(catRes.status === 'fulfilled' ? normalizeListResponse(catRes.value).results || [] : [])
        setProductRows(productRes.status === 'fulfilled' ? normalizeListResponse(productRes.value).results || [] : [])
        setServiceRows(serviceRes.status === 'fulfilled' ? normalizeListResponse(serviceRes.value).results || [] : [])
        const mgrs = managersRes.status === 'fulfilled' ? managersRes.value || [] : []
        setManagers(mgrs)
        setControllers(controllersRes.status === 'fulfilled' ? controllersRes.value || [] : [])
        const supList = supRes.status === 'fulfilled' ? supRes.value : null
        const supNorm = supList ? normalizeListResponse(supList) : { results: [] }
        setSupplierRows(supNorm.results || [])
        setAutoNumber(nextNumRes.status === 'fulfilled' ? (nextNumRes.value?.number || '') : '')
        setForm((prev) => ({
          ...prev,
          recipient_id: prev.recipient_id || (mgrs[0] ? String(mgrs[0].id) : ''),
        }))
      })
      .catch(() => setRows([]))
      .finally(() => {
        setLoading(false)
        try {
          window.dispatchEvent(new CustomEvent('issue-notes:changed'))
        } catch {
          /* ignore */
        }
      })
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const s = searchParams.get('status')
    if (s) setStatusFilter(s)
  }, [searchParams])

  useEffect(() => {
    if (!detailsOpen) {
      setSupplierComboText('')
      setSupplierComboOpen(false)
    }
  }, [detailsOpen])

  useEffect(() => {
    if (detailsOpen && selectedNote?.id) {
      setDetailsCardsOpen({
        procurementNotes: true,
        procurementReadonly: true,
        procurementForm: true,
      })
    }
  }, [detailsOpen, selectedNote?.id])

  useEffect(() => {
    if (!supplierComboOpen) return
    const onDocDown = (e) => {
      if (supplierComboRef.current && !supplierComboRef.current.contains(e.target)) {
        setSupplierComboOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [supplierComboOpen])

  useEffect(() => {
    if (!canSeeShortageHints) setShortageFilter('')
  }, [canSeeShortageHints])

  useEffect(() => {
    if (!canSeeShortageHints) {
      setNoteShortageById({})
      setNoteHoverInfoById({})
      return () => {}
    }
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
          warehouseMap[String(pid)] = Array.from(wh.entries()).map(([name, qty]) => `${name}: ${formatQuantity(qty)}`)
        })
        const next = {}
        const hoverInfo = {}
        rowsWithItems.forEach((note) => {
          const shortages = (note?.items || []).map((it) => {
            if (!it?.product) return false
            const need = effectiveIssueLineQty(it)
            const total = Number(totals[String(it?.product)] || 0)
            return need > total
          })
          next[String(note.id)] = shortages.some(Boolean)
          const itemLines = (note?.items || []).map((it) => {
            const pid = String(it?.product || '')
            const need = effectiveIssueLineQty(it)
            const total = Number(totals[pid] || 0)
            const lack = it?.product ? Math.max(0, need - total) : 0
            const label = issueLineLabel(it, t)
            const warehouses = it?.product ? (warehouseMap[pid]?.length ? warehouseMap[pid].join(', ') : t('common.none')) : 'Не складская позиция'
            return {
              shortage: lack > 0,
              productLabel: label,
              need: formatQuantity(need),
              total: formatQuantity(total),
              lack: formatQuantity(lack),
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
  }, [rows, canSeeShortageHints, t])

  const controllerItemSig =
    selectedNote?.status === 'awaiting_controller' && selectedNote?.items?.length
      ? selectedNote.items.map((i) => i.id).join(',')
      : ''

  useEffect(() => {
    setPlacementZonesByWh({})
  }, [selectedNote?.id])

  useEffect(() => {
    if (!detailsOpen || selectedNote?.status !== 'awaiting_controller') {
      setPlacementWarehouses([])
      return
    }
    if (!canUserInspectIssueNote(user, selectedNote)) {
      setPlacementWarehouses([])
      return
    }
    let alive = true
    warehouseApi
      .warehouses({ page_size: 500, is_active: true })
      .then((d) => {
        if (!alive) return
        setPlacementWarehouses(normalizeListResponse(d).results || [])
      })
      .catch(() => {
        if (alive) setPlacementWarehouses([])
      })
    return () => {
      alive = false
    }
  }, [detailsOpen, selectedNote?.id, selectedNote?.status, selectedNote?.inspection_invited_user_ids, user])

  useEffect(() => {
    if (!detailsOpen || !selectedNote?.items?.length) {
      setControllerLines([])
      return
    }
    if (selectedNote.status !== 'awaiting_controller') {
      setControllerLines([])
      return
    }
    if (!canUserInspectIssueNote(user, selectedNote)) {
      setControllerLines([])
      return
    }
    setControllerLines(
      selectedNote.items.map((it) => ({
        item_id: it.id,
        actualQty: String(it.actual_quantity != null ? it.actual_quantity : it.quantity ?? ''),
        inspectionComment: String(it.inspection_comment || ''),
        photoFiles: [],
        warehouseId: '',
        zoneId: '',
      }))
    )
  }, [
    detailsOpen,
    selectedNote?.id,
    selectedNote?.status,
    selectedNote?.inspection_invited_user_ids,
    controllerItemSig,
    user,
  ])

  useEffect(() => {
    if (!detailsOpen || !selectedNote) {
      setAssignControllerIds([])
      return
    }
    if (selectedNote.status === 'await_ctrl_pick') {
      const ids = selectedNote.inspection_invited_user_ids
      setAssignControllerIds(Array.isArray(ids) ? ids.map((x) => Number(x)) : [])
      return
    }
    setAssignControllerIds([])
  }, [detailsOpen, selectedNote?.id, selectedNote?.status, selectedNote?.inspection_invited_user_ids])

  useEffect(() => {
    if (!detailsOpen || !selectedNote) return
    const d = selectedNote.procurement_purchase_date
    const sid =
      selectedNote.procurement_supplier != null && selectedNote.procurement_supplier !== ''
        ? String(selectedNote.procurement_supplier)
        : ''
    setProcurementForm({
      procurement_purchase_date: typeof d === 'string' ? d.slice(0, 10) : d || '',
      procurement_amount: selectedNote.procurement_amount ?? '',
      procurement_quantity_note: selectedNote.procurement_quantity_note || '',
      procurement_supplier: sid,
      procurement_vehicle: selectedNote.procurement_vehicle || '',
      procurement_delivery_notes: selectedNote.procurement_delivery_notes || '',
      procurement_scan: null,
    })
    if (sid && selectedNote.procurement_supplier_name) {
      setSupplierComboText(
        selectedNote.procurement_supplier_inn
          ? `${selectedNote.procurement_supplier_name} · ${selectedNote.procurement_supplier_inn}`
          : String(selectedNote.procurement_supplier_name)
      )
    } else if (!sid) {
      setSupplierComboText('')
    }
  }, [
    detailsOpen,
    selectedNote?.id,
    selectedNote?.procurement_purchase_date,
    selectedNote?.procurement_amount,
    selectedNote?.procurement_quantity_note,
    selectedNote?.procurement_supplier,
    selectedNote?.procurement_vehicle,
    selectedNote?.procurement_delivery_notes,
    selectedNote?.procurement_scan_url,
  ])

  useEffect(() => {
    if (!detailsOpen) return
    const id = procurementForm.procurement_supplier
    if (!id) return
    const s = supplierRows.find((x) => String(x.id) === String(id))
    if (!s) return
    const label = formatSupplierComboLabel(s)
    setSupplierComboText((prev) => (!prev ? label : prev))
  }, [detailsOpen, procurementForm.procurement_supplier, supplierRows])

  const pickProcurementSupplier = (s) => {
    setProcurementForm((p) => ({ ...p, procurement_supplier: String(s.id) }))
    setSupplierComboText(formatSupplierComboLabel(s))
    setSupplierComboOpen(false)
  }

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
        if (!qty || qty <= 0) return null
        if (it.kind === 'service') {
            const sid = Number(it.service)
            if (!sid) return null
            return { service: sid, quantity: formatQuantity(qty), comment: (it.comment || '').trim() }
          }
          const pid = Number(it.product)
          if (!pid) return null
          return { product: pid, quantity: formatQuantity(qty), comment: (it.comment || '').trim() }
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
      setItems([{ kind: 'product', category: '', product: '', service: '', quantity: '', comment: '' }])
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
      const payload =
        status === 'rejected'
          ? { status: 'note_completed', rejection_comment: rejectionComment }
          : { status }
      await ordersApi.issueNoteUpdate(id, payload)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const openDetailsById = async (id, fallbackRow = null, { clearError = true } = {}) => {
    if (clearError) setError('')
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

  const openDetails = async (row) => openDetailsById(row.id, row, {})

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

  const refreshNoteInModal = async (id) => {
    setError('')
    try {
      const full = await ordersApi.issueNoteGet(id)
      setSelectedNote(full)
      await loadStockForNote(full)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.detailsLoadError'))
    }
  }

  const patchIssueStatus = async (status, { closeAfter = true } = {}) => {
    if (!selectedNote?.id) return
    setError('')
    try {
      await ordersApi.issueNoteUpdate(selectedNote.id, { status })
      await refreshNoteInModal(selectedNote.id)
      if (closeAfter) closeDetails()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const onSendToProcurementFromDetails = () => {
    if (!selectedNote?.id) return
    setError('')
    setProcurementCommentModal({ open: true, noteId: selectedNote.id, text: '' })
  }

  const submitProcurementComment = async () => {
    const noteId = procurementCommentModal.noteId
    const trimmed = String(procurementCommentModal.text || '').trim()
    if (!noteId || !trimmed) {
      setError(t('issueNotes.rejectCommentRequired'))
      return
    }
    setError('')
    try {
      await ordersApi.issueNoteSendToProcurement(noteId, { procurement_notes: trimmed })
      setProcurementCommentModal({ open: false, noteId: null, text: '' })
      await load()
      if (selectedNote?.id === noteId) closeDetails()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const submitQuickSupplier = async () => {
    const name = String(supplierQuickModal.name || '').trim()
    if (!name) {
      setError(t('issueNotes.procurementSupplierNameRequired'))
      return
    }
    setError('')
    try {
      const created = await suppliersApi.create({
        name,
        inn: String(supplierQuickModal.inn || '').trim(),
        contact: String(supplierQuickModal.contact || '').trim(),
      })
      setSupplierRows((prev) => [...prev, created].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')))
      setProcurementForm((p) => ({
        ...p,
        procurement_supplier: String(created.id),
      }))
      setSupplierQuickModal({ open: false, name: '', inn: '', contact: '' })
      setSupplierComboText(formatSupplierComboLabel(created))
    } catch (err) {
      setError(formatApiErrorDetail(err?.response?.data) || t('issueNotes.createError'))
    }
  }

  const onSaveProcurementDetails = async () => {
    if (!selectedNote?.id) return
    setError('')
    try {
      const payload = {
        procurement_purchase_date: procurementForm.procurement_purchase_date || undefined,
        procurement_amount: procurementForm.procurement_amount === '' ? undefined : procurementForm.procurement_amount,
        procurement_quantity_note: procurementForm.procurement_quantity_note,
        procurement_supplier:
          procurementForm.procurement_supplier === '' ? null : Number(procurementForm.procurement_supplier),
        procurement_item_ids: procurementItemIds,
        procurement_vehicle: procurementForm.procurement_vehicle,
        procurement_delivery_notes: procurementForm.procurement_delivery_notes,
        procurement_scan: procurementForm.procurement_scan || undefined,
      }
      await ordersApi.issueNoteProcurementDetails(selectedNote.id, payload)
      await refreshNoteInModal(selectedNote.id)
      setDetailsCardsOpen((s) => ({ ...s, procurementForm: false }))
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const onAssignInspection = async () => {
    if (!selectedNote?.id) return
    if (!assignControllerIds.length) {
      setError(t('issueNotes.assignControllersRequired'))
      return
    }
    setError('')
    try {
      await ordersApi.issueNoteAssignInspection(selectedNote.id, { user_ids: assignControllerIds })
      await refreshNoteInModal(selectedNote.id)
      closeDetails()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const toggleAssignController = (id) => {
    const n = Number(id)
    setAssignControllerIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  const onProcurementDeclineDetails = async () => {
    const rejectionComment = askRejectComment()
    if (!rejectionComment) return
    setError('')
    try {
      await ordersApi.issueNoteProcurementDecline(selectedNote.id, { rejection_comment: rejectionComment })
      await refreshNoteInModal(selectedNote.id)
      closeDetails()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const onProcurementProceedDetails = async () => {
    setError('')
    try {
      await ordersApi.issueNoteProcurementProceed(selectedNote.id)
      await refreshNoteInModal(selectedNote.id)
      closeDetails()
    } catch (err) {
      setError(formatApiErrorDetail(err?.response?.data) || t('issueNotes.procurementFillForm'))
    }
  }

  const onGoodsArrivedDetails = async () => {
    setError('')
    try {
      await ordersApi.issueNoteGoodsArrived(selectedNote.id)
      await refreshNoteInModal(selectedNote.id)
      closeDetails()
    } catch (err) {
      setError(formatApiErrorDetail(err?.response?.data) || t('issueNotes.procurementFillForm'))
    }
  }

  const onControllerComplete = async () => {
    if (!selectedNote?.id) return
    const lines = controllerLines.map((ln) => {
      const aq = formatQuantity(String(ln.actualQty).replace(',', '.'))
      const qtyNum = Number(String(aq).replace(',', '.'))
      const needPlacement = Number.isFinite(qtyNum) && qtyNum > 0
      return {
        item_id: ln.item_id,
        actual_quantity: aq,
        warehouse_id: needPlacement && ln.warehouseId ? Number(ln.warehouseId) : null,
        zone_id: needPlacement && ln.zoneId ? Number(ln.zoneId) : null,
        inspection_comment: (ln.inspectionComment || '').trim(),
        inspection_photos: [],
      }
    })
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]
      if (!Number.isFinite(Number(ln.actual_quantity)) || Number(ln.actual_quantity) < 0) {
        setError(t('issueNotes.validation'))
        return
      }
      if (Number(ln.actual_quantity) > 0) {
        if (!ln.warehouse_id || !ln.zone_id) {
          setError(t('issueNotes.placementRequired'))
          return
        }
      }
    }
    const filesByItemId = {}
    controllerLines.forEach((ln) => {
      if (ln.photoFiles?.length) filesByItemId[ln.item_id] = ln.photoFiles
    })
    setError('')
    try {
      await ordersApi.issueNoteControllerComplete(selectedNote.id, { lines, filesByItemId })
      await refreshNoteInModal(selectedNote.id)
      closeDetails()
    } catch (err) {
      setError(formatApiErrorDetail(err?.response?.data) || t('issueNotes.createError'))
    }
  }

  const loadStockForNote = async (note) => {
    if (!canSeeShortageHints) {
      setStockByProduct({})
      return
    }
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
    setError('')
    try {
      const payload =
        status === 'rejected'
          ? { status: 'note_completed', rejection_comment: rejectionComment }
          : { status }
      await ordersApi.issueNoteUpdate(selectedNote.id, payload)
      await refreshNoteInModal(selectedNote.id)
      if (status === 'rejected') closeDetails()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const noteItems = selectedNote?.items || []
  const stockRowsForSelected = useMemo(
    () =>
      noteItems.map((it, idx) => {
        const stockInfo = stockByProduct[String(it.product)] || { total: 0, byWarehouse: [] }
        const need = effectiveIssueLineQty(it)
        const total = it?.product ? Number(stockInfo.total || 0) : 0
        const shortage = it?.product ? Math.max(0, need - total) : 0
        return {
          key: it.id || idx,
          productLabel: issueLineLabel(it, t),
          need,
          total,
          shortage,
          byWarehouse: it?.product ? (stockInfo.byWarehouse || []) : [],
        }
      }),
    [noteItems, stockByProduct, t]
  )

  const itemShortageByItemId = useMemo(() => {
    const m = {}
    stockRowsForSelected.forEach((row, idx) => {
      const it = noteItems[idx]
      if (!it?.id) return
      if (row.shortage > 0) m[String(it.id)] = true
    })
    return m
  }, [noteItems, stockRowsForSelected])

  const procurementProductGroups = useMemo(() => {
    const items = selectedNote?.items || []
    const map = new Map()
    for (const it of items) {
      const pid = Number(it.product)
      if (!Number.isFinite(pid)) continue
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          label: issueLineLabel(it, t).replace(' - ', ' · '),
          lines: [],
        })
      }
      map.get(pid).lines.push(it)
    }
    return Array.from(map.values())
  }, [selectedNote?.items, t])

  const apiProcurementItemIdsKey = useMemo(
    () => JSON.stringify(selectedNote?.procurement_item_ids || []),
    [selectedNote?.procurement_item_ids]
  )

  const procurementSelectedLinesSummary = useMemo(() => {
    const items = selectedNote?.items || []
    const raw = selectedNote?.procurement_item_ids
    const idSet = new Set((Array.isArray(raw) ? raw : []).map((x) => Number(x)).filter((n) => Number.isFinite(n)))
    if (!idSet.size) return ''
    const labels = items
      .filter((it) => idSet.has(Number(it.id)))
      .map((it) => issueLineLabel(it, t))
    return [...new Set(labels)].filter(Boolean).join('; ')
  }, [selectedNote?.items, selectedNote?.procurement_item_ids, t])

  useEffect(() => {
    if (!detailsOpen || !selectedNote) {
      setProcurementItemIds([])
      return
    }
    if (selectedNote.status !== 'awaiting_procurement' && selectedNote.status !== 'procurement_active') {
      setProcurementItemIds([])
      return
    }
    const fromApi = selectedNote.procurement_item_ids
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      setProcurementItemIds(fromApi.map((x) => Number(x)).filter((n) => Number.isFinite(n)))
      return
    }
    setProcurementItemIds((prev) => {
      const defBase = computeDefaultProcurementItemIds(selectedNote, {})
      if (defBase && defBase.length) return defBase
      if (prev.length > 0) return prev
      const defShort = computeDefaultProcurementItemIds(selectedNote, itemShortageByItemId)
      return defShort && defShort.length ? defShort : []
    })
  }, [detailsOpen, selectedNote?.id, selectedNote?.status, apiProcurementItemIdsKey, itemShortageByItemId, selectedNote?.items])

  const toggleProcurementProductGroup = (productId) => {
    const g = procurementProductGroups.find((x) => x.productId === productId)
    if (!g) return
    const ids = g.lines.map((l) => l.id).filter((id) => id != null).map(Number)
    setProcurementItemIds((prev) => {
      const allIn = ids.length > 0 && ids.every((id) => prev.includes(id))
      if (allIn) return prev.filter((id) => !ids.includes(id))
      const set = new Set(prev)
      ids.forEach((id) => set.add(id))
      return Array.from(set)
    })
  }

  const isProcurementGroupFullySelected = (productId) => {
    const g = procurementProductGroups.find((x) => x.productId === productId)
    if (!g?.lines.length) return false
    const ids = g.lines.map((l) => l.id).filter((id) => id != null).map(Number)
    return ids.length > 0 && ids.every((id) => procurementItemIds.includes(id))
  }

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
      .map((it) => issueLineLabel(it, t))
      .filter(Boolean)
      .join(', ') || t('common.none')

  const noteStatusText = (note) => issueNoteStatusLabel(t, note?.status, note?.status_display || note?.status || '')

  const filteredRows = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase()
    return rows.filter((n) => {
      if (statusFilter && String(n.status) !== String(statusFilter)) return false
      if (objectFilter && String(n.construction_object || '') !== String(objectFilter)) return false
      if (canSeeShortageHints && shortageFilter === 'with' && !noteShortageById[String(n.id)]) return false
      if (canSeeShortageHints && shortageFilter === 'without' && noteShortageById[String(n.id)]) return false
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
  }, [
    rows,
    debouncedSearch,
    statusFilter,
    objectFilter,
    shortageFilter,
    noteShortageById,
    datePreset,
    dateFrom,
    dateTo,
    canSeeShortageHints,
  ])

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

  const tableShowActions =
    canApprove ||
    canSendProcurement ||
    canProcurement ||
    canStorekeeperFlow ||
    canForemanRole

  const issueNotesTableColCount = 8 + (tableShowActions ? 1 : 0)

  const onRowSendProcurement = (e, n) => {
    e.stopPropagation()
    setError('')
    setProcurementCommentModal({ open: true, noteId: n.id, text: '' })
  }

  const onRowQuickPatch = async (e, n, status) => {
    e.stopPropagation()
    try {
      await ordersApi.issueNoteUpdate(n.id, { status })
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const openQuickAssignModal = (e, n) => {
    e.stopPropagation()
    setError('')
    const ids = n.inspection_invited_user_ids
    setQuickAssignIds(Array.isArray(ids) ? ids.map((x) => Number(x)) : [])
    setQuickAssignModal({ open: true, note: n })
  }

  const toggleQuickAssignController = (id) => {
    const num = Number(id)
    setQuickAssignIds((prev) => (prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]))
  }

  const submitQuickAssign = async () => {
    const n = quickAssignModal.note
    if (!n?.id) return
    if (!quickAssignIds.length) {
      setError(t('issueNotes.assignControllersRequired'))
      return
    }
    setError('')
    try {
      await ordersApi.issueNoteAssignInspection(n.id, { user_ids: quickAssignIds })
      setQuickAssignModal({ open: false, note: null })
      setQuickAssignIds([])
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

  const onRowGoodsArrived = async (e, n) => {
    e.stopPropagation()
    setError('')
    try {
      await ordersApi.issueNoteGoodsArrived(n.id)
      await load()
    } catch (err) {
      const detail = formatApiErrorDetail(err?.response?.data)
      const msg = detail || t('issueNotes.procurementFillForm')
      if (err?.response?.status === 400 && n?.id) {
        await openDetailsById(n.id, n, { clearError: false })
        setError(msg)
      } else {
        setError(msg)
      }
    }
  }

  const onRowProcurementProceed = async (e, n) => {
    e.stopPropagation()
    setError('')
    try {
      await ordersApi.issueNoteProcurementProceed(n.id)
      await load()
    } catch (err) {
      const detail = formatApiErrorDetail(err?.response?.data)
      const msg = detail || t('issueNotes.procurementFillForm')
      if (err?.response?.status === 400 && n?.id) {
        await openDetailsById(n.id, n, { clearError: false })
        setError(msg)
      } else {
        setError(msg)
      }
    }
  }

  const onRowProcurementDecline = async (e, n) => {
    e.stopPropagation()
    const rejectionComment = askRejectComment()
    if (!rejectionComment) return
    setError('')
    try {
      await ordersApi.issueNoteProcurementDecline(n.id, { rejection_comment: rejectionComment })
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('issueNotes.createError'))
    }
  }

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
                        <label className={styles.fieldLabel}>Тип позиции</label>
                        <select
                          className={formStyles.select}
                          value={it.kind || 'product'}
                          onChange={(e) => {
                            const value = e.target.value
                            setItems((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, kind: value, category: '', product: '', service: '' } : x))
                            )
                          }}
                        >
                          <option value="product">Товар</option>
                          <option value="service">Услуга</option>
                        </select>
                      </div>
                      {(it.kind || 'product') === 'product' && (
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
                      )}
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>{(it.kind || 'product') === 'service' ? 'Услуга' : t('issueNotes.product')}</label>
                        <select
                          className={formStyles.select}
                          value={(it.kind || 'product') === 'service' ? (it.service || '') : it.product}
                          onChange={(e) => {
                            const value = e.target.value
                            setItems((prev) => prev.map((x, i) => (i === idx ? ((x.kind || 'product') === 'service' ? { ...x, service: value } : { ...x, product: value }) : x)))
                          }}
                        >
                          <option value="">{t('common.none')}</option>
                          {(it.kind || 'product') === 'service'
                            ? serviceRows.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.code} - {s.name}
                                </option>
                              ))
                            : productRows
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
                          value={
                            (it.kind || 'product') === 'service'
                              ? (serviceRows.find((s) => String(s.id) === String(it.service))?.unit || t('common.none'))
                              : (productRows.find((p) => String(p.id) === String(it.product))?.unit || t('common.none'))
                          }
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
                  onClick={() => setItems((prev) => [...prev, { kind: 'product', category: '', product: '', service: '', quantity: '', comment: '' }])}
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
      <Modal
        open={procurementCommentModal.open}
        title={t('issueNotes.sendToProcurement')}
        onClose={() => setProcurementCommentModal({ open: false, noteId: null, text: '' })}
        stacked
      >
        <div className={formStyles.row}>
          <label>{t('issueNotes.procurementNotesPrompt')}</label>
          <textarea
            className={formStyles.input}
            rows={4}
            value={procurementCommentModal.text}
            onChange={(e) => setProcurementCommentModal((m) => ({ ...m, text: e.target.value }))}
          />
        </div>
        <div className={formStyles.actions}>
          <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={submitProcurementComment}>
            {t('common.send')}
          </button>
          <button
            type="button"
            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
            onClick={() => setProcurementCommentModal({ open: false, noteId: null, text: '' })}
          >
            {t('common.cancel')}
          </button>
        </div>
      </Modal>
      <Modal
        open={supplierQuickModal.open}
        title={t('issueNotes.procurementAddSupplier')}
        onClose={() => setSupplierQuickModal({ open: false, name: '', inn: '', contact: '' })}
        stacked
      >
        <div className={formStyles.row}>
          <label>{t('issueNotes.procurementNewSupplierName')}</label>
          <input
            className={formStyles.input}
            value={supplierQuickModal.name}
            onChange={(e) => setSupplierQuickModal((m) => ({ ...m, name: e.target.value }))}
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('suppliers.inn')}</label>
          <input
            className={formStyles.input}
            value={supplierQuickModal.inn}
            onChange={(e) => setSupplierQuickModal((m) => ({ ...m, inn: e.target.value }))}
          />
        </div>
        <div className={formStyles.row}>
          <label>{t('suppliers.contact')}</label>
          <input
            className={formStyles.input}
            value={supplierQuickModal.contact}
            onChange={(e) => setSupplierQuickModal((m) => ({ ...m, contact: e.target.value }))}
          />
        </div>
        <div className={formStyles.actions}>
          <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={submitQuickSupplier}>
            {t('common.save')}
          </button>
          <button
            type="button"
            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
            onClick={() => setSupplierQuickModal({ open: false, name: '', inn: '', contact: '' })}
          >
            {t('common.cancel')}
          </button>
        </div>
      </Modal>
      <Modal
        open={quickAssignModal.open}
        title={
          quickAssignModal.note?.number
            ? `${t('issueNotes.assignControllersTitle')} — ${quickAssignModal.note.number}`
            : t('issueNotes.assignControllersTitle')
        }
        onClose={() => {
          setQuickAssignModal({ open: false, note: null })
          setQuickAssignIds([])
        }}
        stacked
        wide
      >
        <p className={styles.assignHint}>{t('issueNotes.assignControllersHint')}</p>
        {controllers.length ? (
          <div className={styles.controllerChips}>
            {controllers.map((c) => (
              <label key={c.id} className={styles.ctrlChip}>
                <input
                  type="checkbox"
                  checked={quickAssignIds.includes(c.id)}
                  onChange={() => toggleQuickAssignController(c.id)}
                />
                <span>{c.display_name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div>{t('issueNotes.noControllers')}</div>
        )}
        <div className={formStyles.actions}>
          <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={submitQuickAssign}>
            {t('issueNotes.assignAndNotify')}
          </button>
          <button
            type="button"
            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
            onClick={() => {
              setQuickAssignModal({ open: false, note: null })
              setQuickAssignIds([])
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </Modal>
      <Modal open={detailsOpen} title={t('issueNotes.detailsTitle')} onClose={closeDetails} xwide>
        {detailsLoading ? (
          <div>{t('common.loading')}</div>
        ) : !selectedNote ? (
          <div>{t('common.none')}</div>
        ) : (
          <div className={styles.detailsWrap}>
            {error ? <div className={formStyles.error}>{error}</div> : null}
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
            {selectedNote.procurement_notes ? (
              <div className={styles.detailsComment}>
                <button
                  type="button"
                  className={styles.detailsCardHeader}
                  aria-expanded={detailsCardsOpen.procurementNotes}
                  onClick={() =>
                    setDetailsCardsOpen((s) => ({ ...s, procurementNotes: !s.procurementNotes }))
                  }
                >
                  <IconChevronDown
                    size={16}
                    className={`${styles.detailsCardChevron} ${detailsCardsOpen.procurementNotes ? styles.detailsCardChevronOpen : ''}`}
                  />
                  <span className={styles.fieldLabel}>{t('issueNotes.procurementNotesLabel')}</span>
                </button>
                {detailsCardsOpen.procurementNotes ? (
                  <div className={styles.detailsCardBody}>{selectedNote.procurement_notes}</div>
                ) : null}
              </div>
            ) : null}
            {selectedNote.status === 'note_completed' && selectedNote.rejection_comment ? (
              <div className={styles.detailsComment}>
                <div className={styles.fieldLabel}>{t('issueNotes.rejectCommentLabel')}</div>
                <div>{selectedNote.rejection_comment}</div>
              </div>
            ) : null}

            {!(
              canProcurement &&
              (selectedNote.status === 'awaiting_procurement' || selectedNote.status === 'procurement_active')
            ) &&
            (selectedNote.procurement_purchase_date ||
              selectedNote.procurement_amount ||
              selectedNote.procurement_quantity_note ||
              selectedNote.procurement_counterparty ||
              selectedNote.procurement_supplier_name ||
              (Array.isArray(selectedNote.procurement_item_ids) && selectedNote.procurement_item_ids.length > 0) ||
              selectedNote.procurement_vehicle ||
              selectedNote.procurement_delivery_notes ||
              selectedNote.procurement_scan_url) ? (
              <div className={styles.detailsComment}>
                <button
                  type="button"
                  className={styles.detailsCardHeader}
                  aria-expanded={detailsCardsOpen.procurementReadonly}
                  onClick={() =>
                    setDetailsCardsOpen((s) => ({ ...s, procurementReadonly: !s.procurementReadonly }))
                  }
                >
                  <IconChevronDown
                    size={16}
                    className={`${styles.detailsCardChevron} ${detailsCardsOpen.procurementReadonly ? styles.detailsCardChevronOpen : ''}`}
                  />
                  <span className={styles.fieldLabel}>{t('issueNotes.procurementDetailsReadonly')}</span>
                </button>
                {detailsCardsOpen.procurementReadonly ? (
                <div className={`${styles.procurementReadonlyGrid} ${styles.detailsCardBody}`}>
                  {selectedNote.procurement_purchase_date ? (
                    <div>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementPurchaseDate')}</span>{' '}
                      {String(selectedNote.procurement_purchase_date).slice(0, 10)}
                    </div>
                  ) : null}
                  {selectedNote.procurement_amount != null && selectedNote.procurement_amount !== '' ? (
                    <div>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementAmount')}</span> {selectedNote.procurement_amount}
                    </div>
                  ) : null}
                  {selectedNote.procurement_quantity_note ? (
                    <div>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementQtyNote')}</span> {selectedNote.procurement_quantity_note}
                    </div>
                  ) : null}
                  {selectedNote.procurement_supplier_name || selectedNote.procurement_counterparty ? (
                    <>
                      <div>
                        <span className={styles.fieldLabel}>{t('issueNotes.procurementSupplier')}</span>{' '}
                        {selectedNote.procurement_supplier_name || selectedNote.procurement_counterparty}
                      </div>
                      {selectedNote.procurement_supplier_inn ? (
                        <div>
                          <span className={styles.fieldLabel}>{t('suppliers.inn')}</span> {selectedNote.procurement_supplier_inn}
                        </div>
                      ) : null}
                      {selectedNote.procurement_supplier_contact ? (
                        <div>
                          <span className={styles.fieldLabel}>{t('suppliers.contact')}</span> {selectedNote.procurement_supplier_contact}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {procurementSelectedLinesSummary ? (
                    <div className={styles.procurementReadonlyFull}>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementLinesReadonly')}</span> {procurementSelectedLinesSummary}
                    </div>
                  ) : null}
                  {selectedNote.procurement_vehicle ? (
                    <div>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementVehicle')}</span> {selectedNote.procurement_vehicle}
                    </div>
                  ) : null}
                  {selectedNote.procurement_delivery_notes ? (
                    <div className={styles.procurementReadonlyFull}>
                      <span className={styles.fieldLabel}>{t('issueNotes.procurementDeliveryNotes')}</span> {selectedNote.procurement_delivery_notes}
                    </div>
                  ) : null}
                  {selectedNote.procurement_scan_url ? (
                    <div className={styles.procurementReadonlyFull}>
                      <a href={selectedNote.procurement_scan_url} target="_blank" rel="noreferrer">
                        {t('issueNotes.procurementScanLink')}
                      </a>
                    </div>
                  ) : null}
                </div>
                ) : null}
              </div>
            ) : null}

            {canProcurement && (selectedNote.status === 'awaiting_procurement' || selectedNote.status === 'procurement_active') ? (
              <div className={styles.procurementEditBox}>
                <button
                  type="button"
                  className={styles.detailsCardHeader}
                  aria-expanded={detailsCardsOpen.procurementForm}
                  onClick={() =>
                    setDetailsCardsOpen((s) => ({ ...s, procurementForm: !s.procurementForm }))
                  }
                >
                  <IconChevronDown
                    size={16}
                    className={`${styles.detailsCardChevron} ${detailsCardsOpen.procurementForm ? styles.detailsCardChevronOpen : ''}`}
                  />
                  <span className={styles.fieldLabel}>{t('issueNotes.procurementDetailsTitle')}</span>
                </button>
                {detailsCardsOpen.procurementForm ? (
                <div className={styles.detailsCardBody}>
                <div className={styles.procurementEditGrid}>
                  <label className={`${styles.fieldLabel} ${styles.fieldRequired}`}>{t('issueNotes.procurementPurchaseDate')}</label>
                  <input
                    className={formStyles.input}
                    type="date"
                    value={procurementForm.procurement_purchase_date || ''}
                    onChange={(e) => setProcurementForm((p) => ({ ...p, procurement_purchase_date: e.target.value }))}
                  />
                  <label className={styles.fieldLabel}>{t('issueNotes.procurementAmount')}</label>
                  <input
                    className={formStyles.input}
                    type="text"
                    inputMode="decimal"
                    value={procurementForm.procurement_amount}
                    onChange={(e) => setProcurementForm((p) => ({ ...p, procurement_amount: e.target.value }))}
                  />
                  <label className={`${styles.fieldLabel} ${styles.fieldRequired}`}>{t('issueNotes.procurementQtyNote')}</label>
                  <input
                    className={formStyles.input}
                    value={procurementForm.procurement_quantity_note}
                    onChange={(e) => setProcurementForm((p) => ({ ...p, procurement_quantity_note: e.target.value }))}
                  />
                  <label className={`${styles.fieldLabel} ${styles.fieldRequired}`}>{t('issueNotes.procurementSupplier')}</label>
                  <div className={styles.procurementSupplierRow}>
                    <div className={styles.supplierComboWrap} ref={supplierComboRef}>
                      <input
                        className={formStyles.input}
                        type="text"
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={supplierComboOpen}
                        aria-autocomplete="list"
                        placeholder={t('issueNotes.procurementSupplierSearchPlaceholder')}
                        aria-label={t('issueNotes.procurementSupplier')}
                        value={supplierComboText}
                        onChange={(e) => {
                          setSupplierComboText(e.target.value)
                          setSupplierComboOpen(true)
                          setProcurementForm((p) => ({ ...p, procurement_supplier: '' }))
                        }}
                        onFocus={() => setSupplierComboOpen(true)}
                      />
                      {supplierComboOpen ? (
                        <div className={styles.supplierComboPanel} role="listbox">
                          {!supplierRows.length ? (
                            <div className={styles.supplierComboEmpty}>{t('issueNotes.procurementNoSuppliersInDirectory')}</div>
                          ) : suppliersComboFiltered.length ? (
                            <ul className={styles.supplierComboList}>
                              {suppliersComboFiltered.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    className={styles.supplierComboOption}
                                    role="option"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickProcurementSupplier(s)}
                                  >
                                    <span className={styles.supplierComboOptionTitle}>{formatSupplierComboLabel(s)}</span>
                                    {s.contact ? (
                                      <span className={styles.supplierComboOptionMeta}>{s.contact}</span>
                                    ) : null}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className={styles.supplierComboEmpty}>{t('issueNotes.procurementNoSupplierMatch')}</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                      onClick={() => setSupplierQuickModal({ open: true, name: '', inn: '', contact: '' })}
                    >
                      {t('issueNotes.procurementAddSupplier')}
                    </button>
                  </div>
                  <label className={styles.fieldLabel}>{t('issueNotes.procurementVehicle')}</label>
                  <input
                    className={formStyles.input}
                    value={procurementForm.procurement_vehicle}
                    onChange={(e) => setProcurementForm((p) => ({ ...p, procurement_vehicle: e.target.value }))}
                  />
                  <label className={styles.procurementFull}>{t('issueNotes.procurementDeliveryNotes')}</label>
                  <textarea
                    className={`${formStyles.input} ${styles.procurementFull}`}
                    rows={2}
                    value={procurementForm.procurement_delivery_notes}
                    onChange={(e) => setProcurementForm((p) => ({ ...p, procurement_delivery_notes: e.target.value }))}
                  />
                </div>
                {procurementProductGroups.length > 1 ? (
                  <div className={styles.procurementProductPick}>
                    <div className={`${styles.fieldLabel} ${styles.fieldRequired}`}>{t('issueNotes.procurementLinesTitle')}</div>
                    <p className={styles.procurementHint}>{t('issueNotes.procurementLinesPickHint')}</p>
                    <div className={styles.procurementProductCards}>
                      {procurementProductGroups.map((g) => (
                        <div key={g.productId} className={styles.procurementProductCard}>
                          <label>
                            <input
                              type="checkbox"
                              checked={isProcurementGroupFullySelected(g.productId)}
                              onChange={() => toggleProcurementProductGroup(g.productId)}
                            />
                            <span>
                              <strong>{g.label}</strong>
                              {g.lines.length > 1 ? (
                                <span className={styles.procurementCardMeta}>
                                  {' '}
                                  ({g.lines.length} {t('issueNotes.procurementLineCount')})
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className={styles.procurementHint}>{t('issueNotes.procurementLinesAutoHint')}</p>
                )}
                <div className={styles.procurementScanRow}>
                  <label className={styles.fieldLabel}>{t('issueNotes.procurementScanFile')}</label>
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(e) =>
                      setProcurementForm((p) => ({ ...p, procurement_scan: e.target.files?.[0] || null }))
                    }
                  />
                  {selectedNote.procurement_scan_url ? (
                    <a href={selectedNote.procurement_scan_url} target="_blank" rel="noreferrer" className={styles.procurementScanExisting}>
                      {t('issueNotes.procurementScanLink')}
                    </a>
                  ) : null}
                </div>
                <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={onSaveProcurementDetails}>
                  {t('common.save')}
                </button>
                </div>
                ) : null}
              </div>
            ) : null}

            {selectedNote.status === 'await_ctrl_pick' && canApprove && controllers.length > 0 ? (
              <div className={styles.assignBox}>
                <div className={styles.fieldLabel}>{t('issueNotes.assignControllersTitle')}</div>
                <p className={styles.assignHint}>{t('issueNotes.assignControllersHint')}</p>
                <div className={styles.controllerChips}>
                  {controllers.map((c) => (
                    <label key={c.id} className={styles.ctrlChip}>
                      <input
                        type="checkbox"
                        checked={assignControllerIds.includes(c.id)}
                        onChange={() => toggleAssignController(c.id)}
                      />
                      <span>{c.display_name}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={onAssignInspection}>
                  {t('issueNotes.assignAndNotify')}
                </button>
              </div>
            ) : null}

            {selectedNote.status === 'awaiting_controller' && canController && canUserInspectIssueNote(user, selectedNote) ? (
              <div className={`${styles.detailsComment} ${styles.inspectionPanel}`}>
                <div className={styles.fieldLabel}>{t('issueNotes.controllerComplete')}</div>
                <div className={styles.inspectionTableWrap}>
                  <table className={`${tableStyles.table} ${styles.inspectionTable}`}>
                    <thead>
                      <tr>
                        <th>{t('issueNotes.product')}</th>
                        <th>{t('issueNotes.actualQty')}</th>
                        <th>{t('issueNotes.placementWarehouse')}</th>
                        <th>{t('issueNotes.placementZone')}</th>
                        <th>{t('issueNotes.inspectionPhotosPick')}</th>
                        <th>{t('issueNotes.inspectionLineComment')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {controllerLines.map((ln, idx) => {
                        const it = noteItems.find((x) => x.id === ln.item_id)
                        const label = it ? issueLineLabel(it, t) : `#${ln.item_id}`
                        const serviceLine = isServiceLine(it)
                        const whKey = ln.warehouseId ? String(ln.warehouseId) : ''
                        const zonesForRow = whKey ? placementZonesByWh[whKey] || [] : []
                        const zoneOptionLabel = (z) =>
                          [z.code, z.name].filter(Boolean).join(' · ') || `#${z.id}`
                        return (
                          <tr key={ln.item_id}>
                            <td className={styles.inspectionProductCell} title={label}>
                              <span className={`${styles.lineTypeBadge} ${serviceLine ? styles.lineTypeService : styles.lineTypeProduct}`}>
                                {serviceLine ? 'Услуга' : 'Товар'}
                              </span>
                              {label || t('common.none')}
                            </td>
                            <td>
                              <input
                                className={styles.inspectionInput}
                                type="text"
                                inputMode="decimal"
                                value={ln.actualQty}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setControllerLines((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, actualQty: v } : row))
                                  )
                                }}
                              />
                            </td>
                            <td>
                              <select
                                className={styles.inspectionSelect}
                                value={ln.warehouseId || ''}
                                onFocus={() => {
                                  if (ln.warehouseId) ensurePlacementZones(ln.warehouseId)
                                }}
                                onChange={(e) => {
                                  const wid = e.target.value
                                  setControllerLines((prev) =>
                                    prev.map((row, i) =>
                                      i === idx
                                        ? { ...row, warehouseId: wid, zoneId: '' }
                                        : row
                                    )
                                  )
                                  if (wid) ensurePlacementZones(wid)
                                }}
                              >
                                <option value="">{t('issueNotes.placementWarehousePlaceholder')}</option>
                                {placementWarehouses.map((w) => (
                                  <option key={w.id} value={String(w.id)}>
                                    {w.name || `#${w.id}`}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className={styles.inspectionSelect}
                                value={ln.zoneId || ''}
                                disabled={!ln.warehouseId}
                                onFocus={() => {
                                  if (ln.warehouseId) ensurePlacementZones(ln.warehouseId)
                                }}
                                onChange={(e) => {
                                  const zid = e.target.value
                                  setControllerLines((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, zoneId: zid } : row))
                                  )
                                }}
                              >
                                <option value="">{t('issueNotes.placementZonePlaceholder')}</option>
                                {zonesForRow.map((z) => (
                                  <option key={z.id} value={String(z.id)}>
                                    {zoneOptionLabel(z)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <div className={styles.inspectionFileRow}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className={styles.inspectionFile}
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || [])
                                    setControllerLines((prev) =>
                                      prev.map((row, i) =>
                                        i === idx ? { ...row, photoFiles: [...row.photoFiles, ...files] } : row
                                      )
                                    )
                                    e.target.value = ''
                                  }}
                                />
                                <span className={styles.fileCount}>
                                  {ln.photoFiles?.length ? `${ln.photoFiles.length} ${t('issueNotes.filesPicked')}` : '—'}
                                </span>
                                {ln.photoFiles?.length ? (
                                  <button
                                    type="button"
                                    className={styles.clearFilesBtn}
                                    onClick={() =>
                                      setControllerLines((prev) =>
                                        prev.map((row, i) => (i === idx ? { ...row, photoFiles: [] } : row))
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <input
                                className={styles.inspectionInput}
                                type="text"
                                value={ln.inspectionComment}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setControllerLines((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, inspectionComment: v } : row))
                                  )
                                }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={formStyles.actions}>
                  <button type="button" className={`${formStyles.btn} ${formStyles.btnPrimary}`} onClick={onControllerComplete}>
                    {t('issueNotes.controllerComplete')}
                  </button>
                </div>
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
                    <th>{t('issueNotes.actualQty')}</th>
                    <th>{t('issueNotes.cell')}</th>
                    <th>{t('issueNotes.photosCol')}</th>
                    <th>{t('issueNotes.inspectionCommentCol')}</th>
                    <th>{t('products.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {noteItems.length ? (
                    noteItems.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>{it.category_name || it.product_category_name || t('common.none')}</td>
                        <td>
                          <span className={`${styles.lineTypeBadge} ${isServiceLine(it) ? styles.lineTypeService : styles.lineTypeProduct}`}>
                            {isServiceLine(it) ? 'Услуга' : 'Товар'}
                          </span>
                          {issueLineLabel(it, t)}
                        </td>
                        <td>{it.product_unit || it.service_unit || it.unit || t('common.none')}</td>
                        <td>{formatQuantity(it.quantity)}</td>
                        <td>
                          {it.actual_quantity != null && it.actual_quantity !== ''
                            ? formatQuantity(it.actual_quantity)
                            : t('common.none')}
                        </td>
                        <td>{it.cell_label || t('common.none')}</td>
                        <td className={styles.photoLinksCell}>
                          {Array.isArray(it.inspection_photos) && it.inspection_photos.length
                            ? it.inspection_photos.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className={styles.photoLink}>
                                  {i + 1}
                                </a>
                              ))
                            : t('common.none')}
                        </td>
                        <td>{it.inspection_comment || t('common.none')}</td>
                        <td>{it.comment || t('common.none')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>{t('common.none')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {canSeeShortageHints &&
            !(selectedNote.status === 'awaiting_controller' && canController && canUserInspectIssueNote(user, selectedNote)) ? (
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
                          <span>{t('issueNotes.qty')}:</span> <b>{formatQuantity(row.need)}</b>
                        </div>
                        <div className={styles.stockLine}>
                          <span>{t('issueNotes.stockTotal')}:</span> <b>{formatQuantity(row.total)}</b>
                        </div>
                        <div className={`${styles.stockLine} ${row.shortage > 0 ? styles.stockDanger : ''}`}>
                          <span>{t('issueNotes.shortageQty')}:</span> <b>{formatQuantity(row.shortage)}</b>
                        </div>
                        <div className={styles.stockWarehouses}>
                          {row.byWarehouse.length
                            ? row.byWarehouse.map((w) => `${w.warehouse}: ${formatQuantity(w.qty)}`).join(', ')
                            : t('common.none')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className={`${formStyles.actions} ${styles.detailActions}`}>
              {selectedNote.status === 'awaiting_release' && canStorekeeperFlow ? (
                <p className={styles.detailWorkflowHint}>{t('issueNotes.storekeeperAwaitManagerApprove')}</p>
              ) : null}
              {selectedNote.status === 'submitted' && canApprove ? (
                <>
                  {canShowIssueNoteApproveButton(user, selectedNote, noteShortageById, canSeeShortageHints) ? (
                    <button
                      type="button"
                      className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                      onClick={() => onApproveFromDetails('approved')}
                    >
                      {t('issueNotes.approve')}
                    </button>
                  ) : canSeeShortageHints && issueNoteApproveBlockedByShortage(selectedNote, noteShortageById) ? (
                    <button
                      type="button"
                      disabled
                      className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                      title={t('issueNotes.approveBlockedByShortage')}
                    >
                      {t('issueNotes.approve')}
                    </button>
                  ) : null}
                </>
              ) : null}
              {selectedNote.status === 'submitted' && canApprove ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                  onClick={() => onApproveFromDetails('rejected')}
                >
                  {t('issueNotes.reject')}
                </button>
              ) : null}
              {selectedNote.status === 'submitted' && canSendProcurement ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                  onClick={onSendToProcurementFromDetails}
                >
                  {t('issueNotes.sendToProcurement')}
                </button>
              ) : null}
              {selectedNote.status === 'awaiting_procurement' && canProcurement ? (
                <>
                  <button
                    type="button"
                    className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                    onClick={onProcurementProceedDetails}
                  >
                    {t('issueNotes.procurementProceed')}
                  </button>
                  <button
                    type="button"
                    className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                    onClick={onProcurementDeclineDetails}
                  >
                    {t('issueNotes.procurementDecline')}
                  </button>
                </>
              ) : null}
              {selectedNote.status === 'procurement_active' && canProcurement ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                  onClick={onGoodsArrivedDetails}
                >
                  {t('issueNotes.goodsArrived')}
                </button>
              ) : null}
              {selectedNote.status === 'awaiting_release' && canApprove ? (
                <>
                  {canShowIssueNoteApproveButton(user, selectedNote, noteShortageById, canSeeShortageHints) ? (
                    <button
                      type="button"
                      className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                      onClick={() => onApproveFromDetails('approved')}
                    >
                      {t('issueNotes.approve')}
                    </button>
                  ) : canSeeShortageHints && issueNoteApproveBlockedByShortage(selectedNote, noteShortageById) ? (
                    <button
                      type="button"
                      disabled
                      className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                      title={t('issueNotes.approveBlockedByShortage')}
                    >
                      {t('issueNotes.approve')}
                    </button>
                  ) : null}
                </>
              ) : null}
              {selectedNote.status === 'approved' && canStorekeeperFlow ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                  onClick={() => patchIssueStatus('picking')}
                >
                  {t('issueNotes.startPicking')}
                </button>
              ) : null}
              {selectedNote.status === 'picking' && canStorekeeperFlow ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                  onClick={() => patchIssueStatus('ready_pickup')}
                >
                  {t('issueNotes.markReadyPickup')}
                </button>
              ) : null}
              {selectedNote.status === 'ready_pickup' && canForemanConfirmIssueNote(user, selectedNote) ? (
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                  onClick={() => patchIssueStatus('note_completed')}
                >
                  {t('issueNotes.confirmReceived')}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {error ? <div className={formStyles.error}>{error}</div> : null}

      {!canView ? (
        <div>{t('issueNotes.noAccess')}</div>
      ) : (
        <ListPageDataPanel
          flushTop
          title={t('issueNotes.title')}
          leadExtra={(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              {isForeman(user) ? <p className={styles.foremanListHint} style={{ margin: 0 }}>{t('issueNotes.foremanListHint')}</p> : null}
              {canCreate ? (
                <button type="button" className={tableStyles.btnAdd} onClick={() => setFormOpen(true)}>
                  {t('common.add')}
                </button>
              ) : null}
            </div>
          )}
          loading={loading}
          exportButton={(
            <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={!sortedRows.length}>
              {t('common.exportExcel')}
            </button>
          )}
          search={(
            <ToolbarSearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
              aria-label={t('common.searchPlaceholder')}
            />
          )}
          filters={(
            <>
              <ToolbarFilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t('issueNotes.status')}</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </ToolbarFilterSelect>
              <ToolbarFilterSelect value={objectFilter} onChange={(e) => setObjectFilter(e.target.value)}>
                <option value="">{t('issueNotes.object')}</option>
                {objectFilterOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </ToolbarFilterSelect>
              {canSeeShortageHints ? (
                <ToolbarFilterSelect value={shortageFilter} onChange={(e) => setShortageFilter(e.target.value)}>
                  <option value="">{t('issueNotes.shortageFilterAll')}</option>
                  <option value="with">{t('issueNotes.shortageFilterWith')}</option>
                  <option value="without">{t('issueNotes.shortageFilterWithout')}</option>
                </ToolbarFilterSelect>
              ) : null}
              <ToolbarFilterSelect value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
                <option value="">{t('common.allTime')}</option>
                <option value="today">{t('common.today')}</option>
                <option value="week">{t('common.thisWeek')}</option>
                <option value="month">{t('common.thisMonth')}</option>
                <option value="custom">{t('common.customRange')}</option>
              </ToolbarFilterSelect>
              {datePreset === 'custom' ? (
                <>
                  <ToolbarFilterDateInput
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label={t('common.dateFrom')}
                  />
                  <ToolbarFilterDateInput
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label={t('common.dateTo')}
                  />
                </>
              ) : null}
            </>
          )}
        >
          <div className={`${tableStyles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
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
                {tableShowActions ? <th>{t('common.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pagedSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={issueNotesTableColCount} className={styles.emptyTableMsg}>
                    {rows.length === 0 ? t('issueNotes.emptyList') : t('issueNotes.emptyFiltered')}
                  </td>
                </tr>
              ) : (
                pagedSortedRows.map((n) => (
                <tr
                  key={n.id}
                  className={`${styles.clickableRow} ${canSeeShortageHints && noteShortageById[String(n.id)] ? styles.shortageRow : ''}`}
                  onClick={() => openDetails(n)}
                  onMouseEnter={(e) => {
                    if (!canSeeShortageHints || !noteShortageById[String(n.id)]) return
                    openShortageTooltip(e, noteHoverInfoById[String(n.id)]?.shortageItems || [])
                  }}
                  onMouseMove={(e) => {
                    if (!canSeeShortageHints || !noteShortageById[String(n.id)] || !hoverTooltip.visible || hoverTooltip.type !== 'shortage') return
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
                      onMouseEnter={(e) => {
                        if (!canSeeShortageHints) return
                        openProductsTooltip(e, noteHoverInfoById[String(n.id)]?.productItems || [])
                      }}
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
                  {tableShowActions ? (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.rowActions}>
                        {n.status === 'submitted' && canApprove ? (
                          <>
                            {canShowIssueNoteApproveButton(user, n, noteShortageById, canSeeShortageHints) ? (
                              <button
                                type="button"
                                className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onApprove(n.id, 'approved')
                                }}
                              >
                                {t('issueNotes.approve')}
                              </button>
                            ) : canSeeShortageHints && issueNoteApproveBlockedByShortage(n, noteShortageById) ? (
                              <button
                                type="button"
                                disabled
                                className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                                title={t('issueNotes.approveBlockedByShortage')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {t('issueNotes.approve')}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {n.status === 'submitted' && canApprove ? (
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
                        ) : null}
                        {n.status === 'submitted' && canSendProcurement ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                            onClick={(e) => onRowSendProcurement(e, n)}
                          >
                            {t('issueNotes.sendToProcurement')}
                          </button>
                        ) : null}
                        {n.status === 'awaiting_procurement' && canProcurement ? (
                          <>
                            <button
                              type="button"
                              className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                              onClick={(e) => onRowProcurementProceed(e, n)}
                            >
                              {t('issueNotes.procurementProceed')}
                            </button>
                            <button
                              type="button"
                              className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                              onClick={(e) => onRowProcurementDecline(e, n)}
                            >
                              {t('issueNotes.procurementDecline')}
                            </button>
                          </>
                        ) : null}
                        {n.status === 'procurement_active' && canProcurement ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => onRowGoodsArrived(e, n)}
                          >
                            {t('issueNotes.goodsArrived')}
                          </button>
                        ) : null}
                        {n.status === 'await_ctrl_pick' && canApprove && controllers.length > 0 ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => openQuickAssignModal(e, n)}
                          >
                            {t('issueNotes.rowQuickAssign')}
                          </button>
                        ) : null}
                        {n.status === 'awaiting_release' && canApprove ? (
                          <>
                            {canShowIssueNoteApproveButton(user, n, noteShortageById, canSeeShortageHints) ? (
                              <button
                                type="button"
                                className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onApprove(n.id, 'approved')
                                }}
                              >
                                {t('issueNotes.approve')}
                              </button>
                            ) : canSeeShortageHints && issueNoteApproveBlockedByShortage(n, noteShortageById) ? (
                              <button
                                type="button"
                                disabled
                                className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                                title={t('issueNotes.approveBlockedByShortage')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {t('issueNotes.approve')}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {n.status === 'approved' && canStorekeeperFlow ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => onRowQuickPatch(e, n, 'picking')}
                          >
                            {t('issueNotes.startPicking')}
                          </button>
                        ) : null}
                        {n.status === 'picking' && canStorekeeperFlow ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => onRowQuickPatch(e, n, 'ready_pickup')}
                          >
                            {t('issueNotes.markReadyPickup')}
                          </button>
                        ) : null}
                        {n.status === 'ready_pickup' && canForemanConfirmIssueNote(user, n) ? (
                          <button
                            type="button"
                            className={`${formStyles.btn} ${formStyles.btnPrimary}`}
                            onClick={(e) => onRowQuickPatch(e, n, 'note_completed')}
                          >
                            {t('issueNotes.confirmReceived')}
                          </button>
                        ) : null}
                        {!(
                          (n.status === 'submitted' &&
                            (canShowIssueNoteApproveButton(user, n, noteShortageById, canSeeShortageHints) ||
                              (canApprove && canSeeShortageHints && issueNoteApproveBlockedByShortage(n, noteShortageById)) ||
                              canApprove ||
                              canSendProcurement)) ||
                          (n.status === 'awaiting_procurement' && canProcurement) ||
                          (n.status === 'procurement_active' && canProcurement) ||
                          (n.status === 'await_ctrl_pick' && canApprove && controllers.length > 0) ||
                          (n.status === 'awaiting_release' &&
                            canApprove &&
                            (canShowIssueNoteApproveButton(user, n, noteShortageById, canSeeShortageHints) ||
                              (canSeeShortageHints && issueNoteApproveBlockedByShortage(n, noteShortageById)))) ||
                          (n.status === 'approved' && canStorekeeperFlow) ||
                          (n.status === 'picking' && canStorekeeperFlow) ||
                          (n.status === 'ready_pickup' && canForemanConfirmIssueNote(user, n))
                        )
                          ? t('common.none')
                          : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
                ))
              )}
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
        </ListPageDataPanel>
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
