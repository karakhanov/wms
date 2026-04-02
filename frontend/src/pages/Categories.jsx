import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { products as api } from '../api'
import { useAuth } from '../auth'
import { canManageCategories } from '../permissions'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import FkSelectRow from '../components/FkSelectRow'
import QuickCategoryModal from '../components/QuickCategoryModal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import styles from './Table.module.css'
import formStyles from './Form.module.css'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'

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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())
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

  const requestDelete = (id, name) => setDeleteTarget({ id, name })

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
          <Modal open={formOpen} title={modalTitle} onClose={closeMainOrNested} drawer>
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

          <ConfirmDeleteModal
            open={!!deleteTarget}
            itemName={deleteTarget?.name}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (!deleteTarget) return Promise.resolve()
              return api.categoryDelete(deleteTarget.id).then(() => reloadAll())
            }}
          />
        </>
      )}

      <ListPageDataPanel
        flushTop
        title={t('categories.title')}
        leadExtra={canManage ? (
          <button type="button" className={styles.btnAdd} onClick={openCreate}>
            {t('common.add')}
          </button>
        ) : null}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
            {t('common.exportExcel')}
          </button>
        )}
        search={(
          <ToolbarSearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.searchPlaceholder')}
          />
        )}
        filters={(
          <ToolbarFilterSelect
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
          </ToolbarFilterSelect>
        )}
      >
        <DataTable
          columns={[
            { key: 'name', header: <SortHeader className={styles.sortableHeader} label={t('categories.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'parent', header: <SortHeader className={styles.sortableHeader} label={t('categories.parent')} sortKey="parent" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            ...(canManage ? [{ key: 'actions', header: t('common.actions') }] : []),
          ]}
          rows={sortedList}
          rowKey="id"
          selection={{
            selectedIds,
            onToggleAll: (checked) => setSelectedIds(checked ? new Set(sortedList.map((c) => c.id)) : new Set()),
            onToggleOne: (id, checked) => {
              const next = new Set(selectedIds)
              if (checked) next.add(id)
              else next.delete(id)
              setSelectedIds(next)
            },
          }}
          renderCell={(c, col) => {
            if (col.key === 'name') return c.name
            if (col.key === 'parent') return allCats.find((x) => x.id === c.parent)?.name ?? t('common.none')
            if (col.key === 'actions' && canManage) {
              return (
                <span className={styles.actions}>
                  <button type="button" className={styles.btnSm} onClick={() => openEdit(c)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => requestDelete(c.id, c.name)}>
                    {t('common.delete')}
                  </button>
                </span>
              )
            }
            return null
          }}
          page={page}
          pageCount={pages}
          total={count}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={loading}
          bulkActions={
            <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={loading}>
              {t('common.exportExcel')}
            </button>
          }
        />
      </ListPageDataPanel>
    </div>
  )
}
