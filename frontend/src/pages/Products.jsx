import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { products as productsApi } from '../api'
import { useAuth } from '../auth'
import { canManageProducts } from '../permissions'
import ProductEditorModal from '../components/ProductEditorModal'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import styles from './Table.module.css'

function photoUrl(photo) {
  if (!photo) return null
  if (photo.startsWith('http')) return photo
  return `/${photo}`.replace(/^\/+/, '/')
}

export default function Products() {
  const { t } = useTranslation()
  const { user } = useAuth()
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

  const handleDelete = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    productsApi.delete(id).then(() => load()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

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
        <ProductEditorModal
          open={editor.open}
          productId={editor.productId}
          onClose={closeEditor}
          onSaved={load}
        />
      )}
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('products.title')}</h1>
        </div>
        {canManage && (
          <button type="button" className={styles.btnAdd} onClick={openCreate}>
            {t('common.add')}
          </button>
        )}
      </div>

      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onExport={exportCsv}
        exportDisabled={loading}
      >
        <select
          className={toolbarStyles.filterSelect}
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
        </select>
        <select
          className={toolbarStyles.filterSelect}
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
        </select>
      </TableToolbar>

      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('common.photo')}</th>
                  <SortHeader className={styles.sortableHeader} label={t('products.sku')} sortKey="sku" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('products.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('products.barcode')} sortKey="barcode" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('products.category')} sortKey="category" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('products.unit')} sortKey="unit" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('products.amount')} sortKey="amount" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.photo ? (
                        <img src={photoUrl(p.photo)} alt="" className={styles.thumb} />
                      ) : (
                        <span className={styles.thumbPlaceholder}>—</span>
                      )}
                    </td>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.barcode || t('common.none')}</td>
                    <td>{p.category_name || t('common.none')}</td>
                    <td>{p.unit}</td>
                    <td>{p.amount}</td>
                    {canManage && (
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnSm} onClick={() => openEdit(p.id)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnSm} ${styles.btnDanger}`}
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationDock}>
            <PaginationBar
              page={page}
              pageCount={pages}
              total={count}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </div>
  )
}
