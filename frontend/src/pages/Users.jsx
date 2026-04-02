import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { users as usersApi, construction as constructionApi } from '../api'
import { useAuth } from '../auth'
import { canCreateUser, canViewUsers, getRole, isAdmin } from '../permissions'
import Modal from '../components/Modal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

export default function Users() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tableData, setTableData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const [roles, setRoles] = useState([])
  const [roleId, setRoleId] = useState('')
  const [sortKey, setSortKey] = useState('username')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [objects, setObjects] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [selectedObjects, setSelectedObjects] = useState([])
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: '',
    assigned_objects: [],
  })
  const canManageAssignments = canViewUsers(user)
  const canOpenCreate = isAdmin(user) && canCreateUser(user)

  useEffect(() => {
    usersApi
      .roles()
      .then((d) => setRoles(d.results || d || []))
      .catch(() => setRoles([]))
    constructionApi
      .objects({ page_size: 500, is_active: true })
      .then((d) => setObjects(d.results || d || []))
      .catch(() => setObjects([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
    }
    if (roleId) params.role = roleId
    usersApi
      .list(params)
      .then((d) => setTableData(normalizeListResponse(d)))
      .catch(() => setTableData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [page, pageSize, debouncedSearch, roleId])

  useEffect(() => {
    load()
  }, [load])

  const rows = tableData.results || []
  const sortedRows = useMemo(() => {
    const arr = [...rows]
    const factor = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const pick = (row) => {
        if (sortKey === 'username') return String(row.username || '')
        if (sortKey === 'full_name') return String(row.full_name || '')
        if (sortKey === 'role') return String(row.role_display || row.role_name || '')
        if (sortKey === 'objects') return String((row.assigned_object_names || []).join(', '))
        return ''
      }
      return String(pick(a)).localeCompare(String(pick(b)), 'ru') * factor
    })
    return arr
  }, [rows, sortKey, sortDir])
  const count = tableData.count ?? rows.length
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
      }
      if (roleId) params.role = roleId
      const data = await usersApi.list(params)
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `users_${new Date().toISOString().slice(0, 10)}`,
        [t('users.username'), t('users.fullName'), t('users.role')],
        results.map((u) => [u.username, u.full_name || '', u.role_display || u.role_name || ''])
      )
    } catch {
      /* empty */
    }
  }

  const openAssignModal = (u) => {
    setEditingUser(u)
    setSelectedObjects((u.assigned_objects || []).map((id) => String(id)))
    setError('')
    setAssignOpen(true)
  }

  const toggleObject = (id) => {
    setSelectedObjects((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const saveAssignments = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    setError('')
    try {
      await usersApi.assignObjects(editingUser.id, selectedObjects.map((x) => Number(x)))
      setAssignOpen(false)
      setEditingUser(null)
      load()
    } catch (err) {
      setError(err?.response?.data?.detail || t('users.assignSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const openCreateModal = () => {
    setCreateForm({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: '',
      assigned_objects: [],
    })
    setCreateError('')
    setCreateOpen(true)
  }

  const toggleCreateObject = (id) => {
    setCreateForm((prev) => {
      const key = String(id)
      const has = prev.assigned_objects.includes(key)
      return {
        ...prev,
        assigned_objects: has ? prev.assigned_objects.filter((x) => x !== key) : [...prev.assigned_objects, key],
      }
    })
  }

  const saveCreateUser = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.username.trim() || !createForm.password.trim() || !createForm.role) {
      setCreateError(t('users.createValidation'))
      return
    }
    setCreateSaving(true)
    try {
      await usersApi.create({
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        full_name: createForm.full_name.trim(),
        role: Number(createForm.role),
        assigned_objects:
          roles.find((r) => String(r.id) === String(createForm.role))?.name === 'foreman'
            ? createForm.assigned_objects.map((x) => Number(x))
            : [],
      })
      setCreateOpen(false)
      load()
    } catch (err) {
      setCreateError(err?.response?.data?.detail || t('users.createError'))
    } finally {
      setCreateSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      {canManageAssignments && (
        <Modal open={assignOpen} title={t('users.assignObjects')} onClose={() => setAssignOpen(false)} drawer>
          <form onSubmit={saveAssignments} className={`${formStyles.form} ${formStyles.formModal}`}>
            <div className={formStyles.row}>
              <label>{t('users.user')}</label>
              <input className={formStyles.input} value={editingUser?.username || ''} disabled />
            </div>
            <div className={formStyles.row}>
              <label>{t('users.assignedObjects')}</label>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('users.objectSelect')}</th>
                      <th>{t('objects.code')}</th>
                      <th>{t('objects.name')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((o) => {
                      const checked = selectedObjects.includes(String(o.id))
                      return (
                        <tr key={o.id}>
                          <td>
                            <input type="checkbox" checked={checked} onChange={() => toggleObject(String(o.id))} />
                          </td>
                          <td>{o.code || t('common.none')}</td>
                          <td>{o.name}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {error ? <div className={formStyles.error}>{error}</div> : null}
            <div className={formStyles.actions}>
              <button className={`${formStyles.btn} ${formStyles.btnPrimary}`} type="submit" disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
              <button
                type="button"
                className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                onClick={() => setAssignOpen(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {canOpenCreate && (
        <Modal open={createOpen} title={t('users.createUser')} onClose={() => setCreateOpen(false)} drawer>
          <form onSubmit={saveCreateUser} className={`${formStyles.form} ${formStyles.formModal}`}>
            <div className={formStyles.row}>
              <label>{t('users.username')}</label>
              <input
                className={formStyles.input}
                value={createForm.username}
                onChange={(e) => setCreateForm((v) => ({ ...v, username: e.target.value }))}
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('login.password')}</label>
              <input
                className={formStyles.input}
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((v) => ({ ...v, password: e.target.value }))}
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('users.fullName')}</label>
              <input
                className={formStyles.input}
                value={createForm.full_name}
                onChange={(e) => setCreateForm((v) => ({ ...v, full_name: e.target.value }))}
              />
            </div>
            <div className={formStyles.row}>
              <label>Email</label>
              <input
                className={formStyles.input}
                value={createForm.email}
                onChange={(e) => setCreateForm((v) => ({ ...v, email: e.target.value }))}
              />
            </div>
            <div className={formStyles.row}>
              <label>{t('users.role')}</label>
              <select
                className={formStyles.select}
                value={createForm.role}
                onChange={(e) => setCreateForm((v) => ({ ...v, role: e.target.value, assigned_objects: [] }))}
              >
                <option value="">{t('common.none')}</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {roles.find((r) => String(r.id) === String(createForm.role))?.name === 'foreman' && (
              <div className={formStyles.row}>
                <label>{t('users.assignedObjects')}</label>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <tbody>
                      {objects.map((o) => {
                        const key = String(o.id)
                        const checked = createForm.assigned_objects.includes(key)
                        return (
                          <tr key={o.id}>
                            <td><input type="checkbox" checked={checked} onChange={() => toggleCreateObject(o.id)} /></td>
                            <td>{o.code || t('common.none')}</td>
                            <td>{o.name}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {createError ? <div className={formStyles.error}>{createError}</div> : null}
            <div className={formStyles.actions}>
              <button className={`${formStyles.btn} ${formStyles.btnPrimary}`} type="submit" disabled={createSaving}>
                {createSaving ? t('common.loading') : t('common.save')}
              </button>
              <button
                type="button"
                className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                onClick={() => setCreateOpen(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <ListPageDataPanel
        flushTop
        title={t('users.title')}
        leadExtra={canOpenCreate ? (
          <button type="button" className={styles.btnAdd} onClick={openCreateModal}>
            {t('users.createUser')}
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
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value)
              setPage(1)
            }}
            aria-label={t('users.role')}
          >
            <option value="">{t('common.all')}</option>
            {roles.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </ToolbarFilterSelect>
        )}
      >
        <DataTable
          columns={[
            { key: 'username', header: <SortHeader className={styles.sortableHeader} label={t('users.username')} sortKey="username" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'full_name', header: <SortHeader className={styles.sortableHeader} label={t('users.fullName')} sortKey="full_name" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'role', header: <SortHeader className={styles.sortableHeader} label={t('users.role')} sortKey="role" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            { key: 'objects', header: <SortHeader className={styles.sortableHeader} label={t('users.assignedObjects')} sortKey="objects" activeKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /> },
            ...(canManageAssignments ? [{ key: 'actions', header: t('common.actions') }] : []),
          ]}
          rows={sortedRows}
          rowKey="id"
          selection={{
            selectedIds,
            onToggleAll: (checked) => setSelectedIds(checked ? new Set(sortedRows.map((u) => u.id)) : new Set()),
            onToggleOne: (id, checked) => {
              const next = new Set(selectedIds)
              if (checked) next.add(id)
              else next.delete(id)
              setSelectedIds(next)
            },
          }}
          renderCell={(u, col) => {
            if (col.key === 'username') return u.username
            if (col.key === 'full_name') return u.full_name || t('common.none')
            if (col.key === 'role') return u.role_display || u.role_name || t('common.none')
            if (col.key === 'objects') return (u.assigned_object_names || []).join(', ') || t('common.none')
            if (col.key === 'actions' && canManageAssignments) {
              return getRole(u) === 'foreman' ? (
                <button type="button" className={styles.btnSm} onClick={() => openAssignModal(u)}>
                  {t('users.assignObjects')}
                </button>
              ) : (
                t('common.none')
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
