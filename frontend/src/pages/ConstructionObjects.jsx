import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import Modal from '../components/Modal'
import TableToolbar from '../components/TableToolbar'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import tableStyles from './Table.module.css'
import formStyles from './Form.module.css'

export default function ConstructionObjects() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = canManageWarehouse(user)
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [form, setForm] = useState({ name: '', code: '', address: '' })
  const debouncedSearch = useDebouncedValue(search, 300)

  const load = useCallback(() => {
    setLoading(true)
    const ordering = `${sortDir === 'desc' ? '-' : ''}${sortKey}`
    constructionApi
      .objects({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        ordering,
      })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [debouncedSearch, page, pageSize, sortKey, sortDir])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const create = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError(t('objects.validation'))
      return
    }
    setSaving(true)
    try {
      await constructionApi.createObject({
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim(),
      })
      setForm({ name: '', code: '', address: '' })
      setFormOpen(false)
      await load()
    } catch {
      setError(t('objects.createError'))
    } finally {
      setSaving(false)
    }
  }

  const toggleSort = (key) => {
    setPage(1)
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const rows = tableData.results || []
  const count = tableData.count ?? rows.length
  const pages = totalPages(count, pageSize)

  const exportCsv = async () => {
    try {
      const ordering = `${sortDir === 'desc' ? '-' : ''}${sortKey}`
      const d = await constructionApi.objects({
        page_size: 500,
        search: debouncedSearch.trim() || undefined,
        ordering,
      })
      const all = normalizeListResponse(d).results || []
      downloadCsv(
        `construction-objects-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('objects.id'), t('objects.name'), t('objects.code'), t('objects.address')],
        all.map((r) => [r.id, r.name, r.code || '', r.address || ''])
      )
    } catch {
      /* empty */
    }
  }

  return (
    <div className={tableStyles.page}>
      {canManage && (
        <Modal open={formOpen} title={t('objects.create')} onClose={() => setFormOpen(false)}>
          <form className={`${formStyles.form} ${formStyles.formModal}`} onSubmit={create}>
            <div className={formStyles.row}>
              <label>{t('objects.name')}</label>
              <input className={formStyles.input} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className={formStyles.row}>
              <label>{t('objects.code')}</label>
              <input className={formStyles.input} value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
            </div>
            <div className={formStyles.row}>
              <label>{t('objects.address')}</label>
              <input className={formStyles.input} value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} />
            </div>
            {error ? <div className={formStyles.error}>{error}</div> : null}
            <div className={formStyles.actions}>
              <button className={`${formStyles.btn} ${formStyles.btnPrimary}`} type="submit" disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
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
      <div className={tableStyles.pageHead}>
        <div>
          <h1 className={tableStyles.h1}>{t('objects.title')}</h1>
        </div>
        {canManage && (
          <button type="button" className={tableStyles.btnAdd} onClick={() => setFormOpen(true)}>
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
        exportDisabled={loading || !rows.length}
      />
      {loading ? (
        <div>{t('common.loading')}</div>
      ) : (
        <div className={tableStyles.pageBody}>
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <SortHeader className={tableStyles.sortableHeader} label={t('objects.id')} sortKey="id" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={tableStyles.sortableHeader} label={t('objects.name')} sortKey="name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={tableStyles.sortableHeader} label={t('objects.code')} sortKey="code" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader className={tableStyles.sortableHeader} label={t('objects.address')} sortKey="address" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.code || t('common.none')}</td>
                    <td>{r.address || t('common.none')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={tableStyles.paginationDock}>
            <PaginationBar
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
          </div>
        </div>
      )}
    </div>
  )
}
