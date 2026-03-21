import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { products as api } from '../api'
import { useAuth } from '../auth'
import { canManageCategories } from '../permissions'
import Modal from '../components/Modal'
import FkSelectRow from '../components/FkSelectRow'
import QuickCategoryModal from '../components/QuickCategoryModal'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import toolbarStyles from '../components/TableToolbar.module.css'

function getList(d) {
  return d?.results ?? d ?? []
}

export default function Categories() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [allCats, setAllCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [parentFilter, setParentFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', parent: '' })
  const [quickCatOpen, setQuickCatOpen] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const canManage = canManageCategories(user)

  useEffect(() => {
    api
      .categories({ page_size: 500 })
      .then((d) => setAllCats(getList(d)))
      .catch(() => setAllCats([]))
  }, [])

  const loadTable = useCallback(() => {
    setLoading(true)
    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      parent: parentFilter || undefined,
    }
    api
      .categories(params)
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, parentFilter])

  useEffect(() => {
    loadTable()
  }, [loadTable])

  const reloadAll = () => {
    api
      .categories({ page_size: 500 })
      .then((d) => setAllCats(getList(d)))
      .catch(() => {})
    loadTable()
  }

  const openCreate = () => {
    setFormOpen(true)
    setEditing(null)
    setForm({ name: '', parent: '' })
  }

  const openEdit = (row) => {
    setFormOpen(true)
    setEditing(row.id)
    setForm({ name: row.name, parent: row.parent || '' })
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: form.name, parent: form.parent || null }
      if (editing === null) {
        await api.categoryCreate(payload)
      } else {
        await api.categoryUpdate(editing, payload)
      }
      setFormOpen(false)
      reloadAll()
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data))
    }
  }

  const remove = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    api.categoryDelete(id).then(() => reloadAll()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

  const closeMainOrNested = () => {
    if (quickCatOpen) {
      setQuickCatOpen(false)
      return
    }
    setFormOpen(false)
  }

  const list = tableData.results || []
  const sortedList = useMemo(() => {
    const arr = [...list]
    const factor = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const parentName = (x) => allCats.find((i) => i.id === x.parent)?.name || ''
      const av = sortKey === 'parent' ? parentName(a) : String(a.name || '')
      const bv = sortKey === 'parent' ? parentName(b) : String(b.name || '')
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return arr
  }, [list, allCats, sortKey, sortDir])
  const count = tableData.count ?? list.length
  const pages = totalPages(count, pageSize)
  const parentOptions = allCats.filter((c) => c.id !== editing)
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
        parent: parentFilter || undefined,
      }
      const data = await api.categories(params)
      const { results } = normalizeListResponse(data)
      const rows = results.map((c) => [
        c.name,
        allCats.find((x) => x.id === c.parent)?.name ?? '',
      ])
      downloadCsv(`categories_${new Date().toISOString().slice(0, 10)}`, [t('categories.name'), t('categories.parent')], rows)
    } catch {
      /* empty */
    }
  }

  const modalTitle = editing === null ? t('categories.new') : `${t('common.edit')} — ${form.name || ''}`

  return (
    <div className={styles.page}>
      {canManage && (
        <>
          <Modal open={formOpen} title={modalTitle} onClose={closeMainOrNested}>
            <form onSubmit={save} className={`${formStyles.form} ${formStyles.formModal}`}>
              <div className={formStyles.row}>
                <label>{t('categories.name')} *</label>
                <input
                  className={formStyles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <FkSelectRow
                label={t('categories.parent')}
                canAdd
                onAdd={() => setQuickCatOpen(true)}
                addTitle={t('products.addCategoryInline')}
                addAriaLabel={t('products.addCategoryInline')}
              >
                <select
                  className={`${formStyles.select} ${formStyles.fkSelect}`}
                  value={form.parent}
                  onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}
                >
                  <option value="">—</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FkSelectRow>
              <div className={formStyles.actions}>
                <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`}>
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                  onClick={() => setFormOpen(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </Modal>

          <QuickCategoryModal
            open={quickCatOpen}
            onClose={() => setQuickCatOpen(false)}
            categories={allCats}
            excludeParentIds={editing != null ? [editing] : []}
            stackDepth={1}
            onCreated={(created) => {
              reloadAll()
              if (created?.id != null) {
                setForm((f) => ({ ...f, parent: String(created.id) }))
              }
            }}
          />
        </>
      )}

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('categories.title')}</h1>
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
          value={parentFilter}
          onChange={(e) => {
            setParentFilter(e.target.value)
            setPage(1)
          }}
          aria-label={t('categories.parent')}
        >
          <option value="">{t('common.all')}</option>
          {allCats.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
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
                  <SortHeader className={styles.sortableHeader} label={t('categories.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('categories.parent')} sortKey="parent" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{allCats.find((x) => x.id === c.parent)?.name ?? t('common.none')}</td>
                    {canManage && (
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnSm} onClick={() => openEdit(c)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnSm} ${styles.btnDanger}`}
                          onClick={() => remove(c.id, c.name)}
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
            <PaginationBar page={page} pageCount={pages} total={count} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} disabled={loading} />
          </div>
        </div>
      )}
    </div>
  )
}
