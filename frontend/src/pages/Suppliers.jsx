import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { suppliers as api } from '../api'
import { useAuth } from '../auth'
import { canManageSuppliers } from '../permissions'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput } from '../components/ToolbarControls'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

export default function Suppliers() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', inn: '', contact: '' })
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canManage = canManageSuppliers(user)

  const loadTable = useCallback(() => {
    setLoading(true)
    api
      .list({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch])

  useEffect(() => {
    loadTable()
  }, [loadTable])

  const openCreate = () => {
    setFormOpen(true)
    setEditing(null)
    setForm({ name: '', inn: '', contact: '' })
  }

  const openEdit = (row) => {
    setFormOpen(true)
    setEditing(row.id)
    setForm({ name: row.name || '', inn: row.inn || '', contact: row.contact || '' })
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing === null) {
        await api.create(form)
      } else {
        await api.update(editing, form)
      }
      setFormOpen(false)
      loadTable()
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data))
    }
  }

  const requestDelete = (id, name) => setDeleteTarget({ id, name })

  const list = tableData.results || []
  const sortedList = useMemo(() => {
    const arr = [...list]
    const factor = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'name') return String(row.name || '')
        if (sortKey === 'inn') return String(row.inn || '')
        if (sortKey === 'contact') return String(row.contact || '')
        return ''
      }
      return String(pick(a)).localeCompare(String(pick(b)), 'ru') * factor
    })
    return arr
  }, [list, sortKey, sortDir])
  const count = tableData.count ?? list.length
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
      const data = await api.list({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `suppliers_${new Date().toISOString().slice(0, 10)}`,
        [t('suppliers.name'), t('suppliers.inn'), t('suppliers.contact')],
        results.map((s) => [s.name, s.inn || '', s.contact || ''])
      )
    } catch {
      /* empty */
    }
  }

  const modalTitle = editing === null ? t('suppliers.new') : `${t('common.edit')} — ${form.name || ''}`

  return (
    <div className={styles.page}>
      {canManage && (
        <>
        <Modal open={formOpen} title={modalTitle} onClose={() => setFormOpen(false)} drawer>
          <form onSubmit={save} className={`${formStyles.form} ${formStyles.formModal}`}>
            <div className={formStyles.row}>
              <label>{t('suppliers.name')} *</label>
              <input
                className={formStyles.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('suppliers.inn')}</label>
              <input
                className={formStyles.input}
                value={form.inn}
                onChange={(e) => setForm((f) => ({ ...f, inn: e.target.value }))}
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('suppliers.contact')}</label>
              <input
                className={formStyles.input}
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </div>
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
        <ConfirmDeleteModal
          open={!!deleteTarget}
          itemName={deleteTarget?.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return Promise.resolve()
            return api.delete(deleteTarget.id).then(() => loadTable())
          }}
        />
        </>
      )}

      <ListPageDataPanel
        flushTop
        title={t('suppliers.title')}
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
        filters={null}
      >
        <DataTable
          columns={[
            { key: 'name', header: <SortHeader className={styles.sortableHeader} label={t('suppliers.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'inn', header: <SortHeader className={styles.sortableHeader} label={t('suppliers.inn')} sortKey="inn" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'contact', header: <SortHeader className={styles.sortableHeader} label={t('suppliers.contact')} sortKey="contact" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            ...(canManage ? [{ key: 'actions', header: t('common.actions') }] : []),
          ]}
          rows={sortedList}
          rowKey="id"
          selection={{
            selectedIds,
            onToggleAll: (checked) => setSelectedIds(checked ? new Set(sortedList.map((s) => s.id)) : new Set()),
            onToggleOne: (id, checked) => {
              const next = new Set(selectedIds)
              if (checked) next.add(id)
              else next.delete(id)
              setSelectedIds(next)
            },
          }}
          renderCell={(s, col) => {
            if (col.key === 'name') return s.name
            if (col.key === 'inn') return s.inn || t('common.none')
            if (col.key === 'contact') return s.contact || t('common.none')
            if (col.key === 'actions' && canManage) {
              return (
                <span className={styles.actions}>
                  <button type="button" className={styles.btnSm} onClick={() => openEdit(s)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => requestDelete(s.id, s.name)}>
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
