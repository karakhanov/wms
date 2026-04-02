import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { products as api } from '../api'
import { useAuth } from '../auth'
import { canManageProducts } from '../permissions'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import EmptyState from '../components/EmptyState'
import DataTable from '../components/DataTable'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import { formatNumberCell, formatNumberInput, numberInputToApi, sanitizeNumberInput } from '../utils/numberFormat'
import styles from './Table.module.css'
import { ToolbarSearchInput } from '../components/ToolbarControls'
import formStyles from './Form.module.css'

export default function Services() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = canManageProducts(user)
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [form, setForm] = useState({ name: '', code: '', unit: 'усл.', amount: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .services({ page, page_size: pageSize, search: search.trim() || undefined })
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, search])

  useEffect(() => {
    load()
  }, [load])

  const rows = tableData.results || []
  const count = tableData.count ?? rows.length
  const pages = totalPages(count, pageSize)
  const listEmptyHint = useMemo(() => {
    if (rows.length > 0) return ''
    if (search.trim()) return t('common.emptyStateFiltered')
    if (canManage) return t('common.emptyStateHintWithAdd', { addLabel: t('common.add') })
    return t('common.emptyStateHintList')
  }, [rows.length, search, canManage, t])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', code: '', unit: 'усл.', amount: '', description: '' })
    setFormOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row.id)
    setForm({
      name: row.name || '',
      code: row.code || '',
      unit: row.unit || 'усл.',
      amount: row.amount || '',
      description: row.description || '',
    })
    setFormOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      unit: form.unit.trim() || 'усл.',
      amount: numberInputToApi(form.amount) || 0,
      description: form.description.trim(),
      is_active: true,
    }
    if (editing) await api.serviceUpdate(editing, payload)
    else await api.serviceCreate(payload)
    setFormOpen(false)
    await load()
  }

  const requestDelete = (id, name) => setDeleteTarget({ id, name })

  return (
    <div className={styles.page}>
      {canManage && (
        <>
        <Modal open={formOpen} title={editing ? 'Редактировать услугу' : 'Новая услуга'} onClose={() => setFormOpen(false)} drawer>
          <form onSubmit={save} className={`${formStyles.form} ${formStyles.formModal}`}>
            <div className={formStyles.row}><label>Название</label><input className={formStyles.input} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required /></div>
            <div className={formStyles.row}><label>Код</label><input className={formStyles.input} value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} required /></div>
            <div className={formStyles.row}><label>Ед.</label><input className={formStyles.input} value={form.unit} onChange={(e) => setForm((v) => ({ ...v, unit: e.target.value }))} /></div>
            <div className={formStyles.row}><label>Сумма</label><input inputMode="decimal" className={formStyles.input} value={formatNumberInput(form.amount)} onChange={(e) => setForm((v) => ({ ...v, amount: sanitizeNumberInput(e.target.value, 2) }))} /></div>
            <div className={formStyles.row}><label>Описание</label><textarea className={formStyles.textarea} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} /></div>
            <div className={formStyles.actions}>
              <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`}>Сохранить</button>
              <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={() => setFormOpen(false)}>Отмена</button>
            </div>
          </form>
        </Modal>
        <ConfirmDeleteModal
          open={!!deleteTarget}
          itemName={deleteTarget?.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return Promise.resolve()
            return api.serviceDelete(deleteTarget.id).then(() => load())
          }}
        />
        </>
      )}
      <ListPageDataPanel
        flushTop
        title="Услуги"
        leadExtra={canManage ? (
          <button type="button" className={styles.btnAdd} onClick={openCreate}>
            {t('common.add')}
          </button>
        ) : null}
        loading={loading}
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
        <div className={styles.listTableShell}>
          {rows.length === 0 ? (
            <EmptyState
              hint={listEmptyHint}
              compact
              actionLabel={canManage ? t('common.add') : undefined}
              onAction={canManage ? openCreate : undefined}
            />
          ) : (
            <DataTable
              columns={[
                { key: 'name', header: 'Название' },
                { key: 'code', header: 'Код' },
                { key: 'unit', header: 'Ед.' },
                { key: 'amount', header: 'Сумма' },
                { key: 'description', header: 'Описание' },
                ...(canManage ? [{ key: 'actions', header: t('common.actions') }] : []),
              ]}
              rows={rows}
              rowKey="id"
              selection={{
                selectedIds,
                onToggleAll: (checked) => setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set()),
                onToggleOne: (id, checked) => {
                  const next = new Set(selectedIds)
                  if (checked) next.add(id)
                  else next.delete(id)
                  setSelectedIds(next)
                },
              }}
              renderCell={(r, col) => {
                if (col.key === 'name') return r.name
                if (col.key === 'code') return r.code
                if (col.key === 'unit') return r.unit
                if (col.key === 'amount') return formatNumberCell(r.amount, 2)
                if (col.key === 'description') return r.description || '—'
                if (col.key === 'actions' && canManage) {
                  return (
                    <span className={styles.actions}>
                      <button className={styles.btnSm} type="button" onClick={() => openEdit(r)}>{t('common.edit')}</button>
                      <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => requestDelete(r.id, r.name)}>
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
            />
          )}
        </div>
      </ListPageDataPanel>
    </div>
  )
}
