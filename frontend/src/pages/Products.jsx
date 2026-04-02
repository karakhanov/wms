import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { products as productsApi } from '../api'
import { useAuth } from '../auth'
import { canManageProducts } from '../permissions'
import ProductEditorModal from '../components/ProductEditorModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import RowActionsMenu from '../components/RowActionsMenu'
import Button from '../components/Button'
import ListPageDataPanel from '../components/ListPageDataPanel'
import EmptyState from '../components/EmptyState'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'
import styles from './Table.module.css'
import pStyles from './Products.module.css'
import { IconNav } from '../ui/Icons'

function photoUrl(photo, photoUrlField) {
  const v = photoUrlField || photo
  if (!v) return null
  if (v.startsWith('http')) return v
  return `/${v}`.replace(/^\/+/, '/')
}

export default function Products() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState({ open: false, productId: null })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [category, setCategory] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [catOptions, setCatOptions] = useState([])
  const [sortKey, setSortKey] = useState('sku')
  const [sortDir, setSortDir] = useState('asc')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canManage = canManageProducts(user)

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      category: category || undefined,
    }
    if (activeFilter !== '') params.is_active = activeFilter === 'true'
    productsApi
      .list(params)
      .then((r) => setList(normalizeListResponse(r)))
      .catch(() => setList({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, category, activeFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    productsApi
      .categories({ page_size: 500 })
      .then((d) => setCatOptions(d.results || d || []))
      .catch(() => setCatOptions([]))
  }, [])

  const requestDelete = (id, name) => setDeleteTarget({ id, name })

  const openCreate = () => setEditor({ open: true, productId: null })
  const openEdit = (id) => setEditor({ open: true, productId: id })
  const closeEditor = () => setEditor({ open: false, productId: null })

  const rows = list.results || []
  const sortedRows = useMemo(() => {
    const arr = [...rows]
    const factor = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'sku') return String(row.sku || '')
        if (sortKey === 'name') return String(row.name || '')
        if (sortKey === 'barcode') return String(row.barcode || '')
        if (sortKey === 'category') return String(row.category_name || '')
        if (sortKey === 'unit') return String(row.unit || '')
        if (sortKey === 'amount') return Number(row.amount || 0)
        return ''
      }
      const av = pick(a)
      const bv = pick(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return arr
  }, [rows, sortKey, sortDir])
  const count = list.count ?? rows.length
  const pages = totalPages(count, pageSize)
  const listEmptyHint = useMemo(() => {
    if (sortedRows.length > 0) return ''
    const hasFilters = debouncedSearch.trim() || category || activeFilter !== ''
    if (hasFilters) return t('common.emptyStateFiltered')
    if (canManage) return t('common.emptyStateHintWithAdd', { addLabel: t('common.add') })
    return t('common.emptyStateHintList')
  }, [sortedRows.length, debouncedSearch, category, activeFilter, canManage, t])
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const exportCsv = async () => {
    try {
      const params = {
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        category: category || undefined,
      }
      if (activeFilter !== '') params.is_active = activeFilter === 'true'
      const r = await productsApi.list(params)
      const { results } = normalizeListResponse(r)
      downloadCsv(
        `products_${new Date().toISOString().slice(0, 10)}`,
        [
          t('products.sku'),
          t('products.name'),
          t('products.barcode'),
          t('products.category'),
          t('products.unit'),
          t('products.amount'),
          t('products.active'),
        ],
        results.map((p) => [
          p.sku,
          p.name,
          p.barcode || '',
          p.category_name || '',
          p.unit,
          p.amount,
          p.is_active ? t('products.active') : t('products.inactive'),
        ])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={styles.page}>
      {canManage && (
        <>
          <ProductEditorModal
            open={editor.open}
            productId={editor.productId}
            onClose={closeEditor}
            onSaved={load}
          />
          <ConfirmDeleteModal
            open={!!deleteTarget}
            itemName={deleteTarget?.name}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (!deleteTarget) return Promise.resolve()
              return productsApi.delete(deleteTarget.id).then(() => load())
            }}
          />
        </>
      )}
      <ListPageDataPanel
        flushTop
        title={t('products.title')}
        leadExtra={canManage ? (
          <Button variant="primary" size="md" onClick={openCreate}>
            {t('common.add')}
          </Button>
        ) : null}
        loading={loading}
        exportButton={(
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading}>
            {t('common.exportExcel')}
          </Button>
        )}
        search={(
          <ToolbarSearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            onClear={() => {
              setSearch('')
              setPage(1)
            }}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.searchPlaceholder')}
          />
        )}
        filters={(
          <>
            <ToolbarFilterSelect
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(1)
              }}
              aria-label={t('products.categoryFilter')}
            >
              <option value="">{t('common.all')} — {t('products.category')}</option>
              {catOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </ToolbarFilterSelect>
            <ToolbarFilterSelect
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value)
                setPage(1)
              }}
              aria-label={t('products.active')}
            >
              <option value="">{t('common.all')}</option>
              <option value="true">{t('common.activeOnly')}</option>
              <option value="false">{t('common.inactiveOnly')}</option>
            </ToolbarFilterSelect>
          </>
        )}
      >
        <div className={styles.listTableShell}>
          {sortedRows.length === 0 ? (
            <EmptyState
              hint={listEmptyHint}
              compact
              actionLabel={canManage ? t('common.add') : undefined}
              onAction={canManage ? openCreate : undefined}
            />
          ) : (
            <DataTable
              columns={[
                { key: 'photo', header: t('common.photo') },
                { key: 'sku', header: <SortHeader className={styles.sortableHeader} label={t('products.sku')} sortKey="sku" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'name', header: <SortHeader className={styles.sortableHeader} label={t('products.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'barcode', header: <SortHeader className={styles.sortableHeader} label={t('products.barcode')} sortKey="barcode" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'category', header: <SortHeader className={styles.sortableHeader} label={t('products.category')} sortKey="category" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'unit', header: <SortHeader className={styles.sortableHeader} label={t('products.unit')} sortKey="unit" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                { key: 'amount', header: <SortHeader className={styles.sortableHeader} label={t('products.amount')} sortKey="amount" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
                ...(canManage ? [{ key: 'actions', header: t('common.actions') }] : []),
              ]}
              rows={sortedRows}
              rowKey="id"
              renderCell={(p, col) => {
                if (col.key === 'photo') {
                  return photoUrl(p.photo, p.photo_url) ? (
                    <span className={pStyles.photoFrame}>
                      <img src={photoUrl(p.photo, p.photo_url)} alt={p.name} className={pStyles.photo} />
                    </span>
                  ) : (
                    <span className={pStyles.photoFrame} aria-hidden>{p.name.charAt(0).toUpperCase()}</span>
                  )
                }
                if (col.key === 'sku') return <span className={pStyles.sku}>{p.sku}</span>
                if (col.key === 'name') return <span className={pStyles.name} onClick={() => navigate(`/products/${p.id}`)}>{p.name}</span>
                if (col.key === 'barcode') return p.barcode || t('common.none')
                if (col.key === 'category') return p.category_name || t('common.none')
                if (col.key === 'unit') return p.unit
                if (col.key === 'amount') return <span className={pStyles.amount}>{p.amount}</span>
                if (col.key === 'actions' && canManage) {
                  return (
                    <RowActionsMenu
                      onEdit={() => openEdit(p.id)}
                      onDelete={() => requestDelete(p.id, p.name)}
                      itemName={p.name}
                    />
                  )
                }
                return null
              }}
              emptyText={t('common.emptyList')}
              page={page}
              pageCount={pages}
              total={count}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              disabled={loading}
            />
          )}
        </div>
      </ListPageDataPanel>
    </div>
  )
}
