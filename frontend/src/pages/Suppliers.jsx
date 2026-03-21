import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { suppliers as api } from '../api'
import { useAuth } from '../auth'
import { canManageSuppliers } from '../permissions'
import Modal from '../components/Modal'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
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

  const remove = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    api.delete(id).then(() => loadTable()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

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
        <Modal open={formOpen} title={modalTitle} onClose={() => setFormOpen(false)}>
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
      )}

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('suppliers.title')}</h1>
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
      />

      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={styles.pageBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader className={styles.sortableHeader} label={t('suppliers.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('suppliers.inn')} sortKey="inn" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={styles.sortableHeader} label={t('suppliers.contact')} sortKey="contact" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedList.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.inn || t('common.none')}</td>
                    <td>{s.contact || t('common.none')}</td>
                    {canManage && (
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnSm} onClick={() => openEdit(s)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnSm} ${styles.btnDanger}`}
                          onClick={() => remove(s.id, s.name)}
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
