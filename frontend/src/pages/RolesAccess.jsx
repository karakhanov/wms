import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { users as usersApi } from '../api'
import { useAuth } from '../auth'
import { canManageRoles } from '../permissions'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import DataTable from '../components/DataTable'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import panelStyles from './DataPanelLayout.module.css'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

export default function RolesAccess() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = canManageRoles(user)
  const [roles, setRoles] = useState([])
  const [policy, setPolicy] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [rolesSort, setRolesSort] = useState({ key: 'name', dir: 'asc' })
  const [resourcesSort, setResourcesSort] = useState({ key: 'resource', dir: 'asc' })
  const [rolesSelectedIds, setRolesSelectedIds] = useState(new Set())
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [rolesData, policyData] = await Promise.all([usersApi.roles(), usersApi.permissionsMatrix()])
      setRoles(rolesData.results || rolesData || [])
      setPolicy(policyData.policy || {})
    } catch {
      setError(t('rolesAccess.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resources = useMemo(() => Object.keys(policy || {}), [policy])
  const roleLabel = (name) => t(`rolesAccess.roleNames.${name}`, { defaultValue: name })
  const resourceLabel = (name) => t(`rolesAccess.resources.${name}`, { defaultValue: name })

  const filteredRoles = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase()
    return roles.filter((r) => {
      if (roleFilter && String(r.name) !== String(roleFilter)) return false
      if (!q) return true
      return [r.name, roleLabel(r.name)].join(' ').toLowerCase().includes(q)
    })
  }, [roles, debouncedSearch, roleFilter])

  const sortedRoles = useMemo(() => {
    const list = [...filteredRoles]
    const factor = rolesSort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (rolesSort.key === 'id') return (Number(a.id || 0) - Number(b.id || 0)) * factor
      return roleLabel(a.name).localeCompare(roleLabel(b.name), 'ru') * factor
    })
    return list
  }, [filteredRoles, rolesSort])

  const filteredResources = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase()
    return resources.filter((resource) => {
      if (resourceFilter && String(resource) !== String(resourceFilter)) return false
      if (!q) return true
      return [resource, resourceLabel(resource)].join(' ').toLowerCase().includes(q)
    })
  }, [resources, debouncedSearch, resourceFilter])

  const sortedResources = useMemo(() => {
    const list = [...filteredResources]
    const factor = resourcesSort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = resourcesSort.key === 'resource' ? resourceLabel(a) : String((policy[a]?.read || []).length + (policy[a]?.write || []).length)
      const bv = resourcesSort.key === 'resource' ? resourceLabel(b) : String((policy[b]?.read || []).length + (policy[b]?.write || []).length)
      return String(av).localeCompare(String(bv), 'ru') * factor
    })
    return list
  }, [filteredResources, resourcesSort, policy])

  const toggleRolesSort = (key) => {
    setRolesSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const toggleResourcesSort = (key) => {
    setResourcesSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const exportCsv = () => {
    const rows = []
    sortedResources.forEach((resource) => {
      sortedRoles.forEach((r) => {
        rows.push([
          roleLabel(r.name),
          resourceLabel(resource),
          (policy[resource]?.read || []).includes(r.name) ? t('common.yes') : t('common.no'),
          (policy[resource]?.write || []).includes(r.name) ? t('common.yes') : t('common.no'),
        ])
      })
    })
    downloadCsv(
      `roles-access-${new Date().toISOString().slice(0, 10)}.csv`,
      [t('rolesAccess.role'), t('rolesAccess.resource'), t('rolesAccess.read'), t('rolesAccess.write')],
      rows
    )
  }

  const togglePermission = (resource, roleName, type) => {
    setPolicy((prev) => {
      const next = { ...prev }
      const rules = next[resource] ? { ...next[resource] } : { read: [], write: [] }
      const set = new Set(rules[type] || [])
      if (set.has(roleName)) set.delete(roleName)
      else set.add(roleName)
      rules[type] = Array.from(set)
      next[resource] = rules
      return next
    })
  }

  const createRole = async () => {
    const roleName = newRole.trim()
    if (!roleName) return
    try {
      await usersApi.roleCreate({ name: roleName })
      setNewRole('')
      await load()
    } catch (e) {
      setError(e?.response?.data?.detail || t('rolesAccess.saveError'))
    }
  }

  const editRole = async (id, currentName) => {
    const nextName = window.prompt(t('rolesAccess.editPrompt'), currentName)
    if (!nextName || nextName.trim() === currentName) return
    try {
      await usersApi.roleUpdate(id, { name: nextName.trim() })
      await load()
    } catch (e) {
      setError(e?.response?.data?.detail || t('rolesAccess.saveError'))
    }
  }

  const deleteRole = async (id) => {
    try {
      await usersApi.roleDelete(id)
      await load()
    } catch (e) {
      setError(e?.response?.data?.detail || t('rolesAccess.saveError'))
    }
  }

  const savePolicy = async () => {
    setSaving(true)
    setError('')
    try {
      await usersApi.permissionsMatrixUpdate(policy)
      await load()
    } catch {
      setError(t('rolesAccess.saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return <div className={styles.page}>{t('issueNotes.noAccess')}</div>
  }

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title={t('rolesAccess.title')}
        loading={loading}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportCsv} disabled={!sortedRoles.length || !sortedResources.length}>
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
            <ToolbarFilterSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{t('rolesAccess.role')}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {roleLabel(r.name)}
                </option>
              ))}
            </ToolbarFilterSelect>
            <ToolbarFilterSelect value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
              <option value="">{t('rolesAccess.resource')}</option>
              {resources.map((resource) => (
                <option key={resource} value={resource}>
                  {resourceLabel(resource)}
                </option>
              ))}
            </ToolbarFilterSelect>
          </>
        )}
      >
      <div className={formStyles.row}>
        <label>{t('rolesAccess.addRole')}</label>
        <div className={formStyles.actions}>
          <input
            className={formStyles.input}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder={t('rolesAccess.roleNamePlaceholder')}
          />
          <button className={`${formStyles.btn} ${formStyles.btnSecondary}`} type="button" onClick={createRole}>
            {t('common.add')}
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: <SortHeader className={styles.sortableHeader} label={t('rolesAccess.role')} sortKey="name" activeKey={rolesSort.key} sortDir={rolesSort.dir} onToggle={toggleRolesSort} /> },
          { key: 'actions', header: t('common.actions') },
        ]}
        rows={sortedRoles}
        rowKey="id"
        selection={{
          selectedIds: rolesSelectedIds,
          onToggleAll: (checked) => setRolesSelectedIds(checked ? new Set(sortedRoles.map((r) => r.id)) : new Set()),
          onToggleOne: (id, checked) => {
            const next = new Set(rolesSelectedIds)
            if (checked) next.add(id)
            else next.delete(id)
            setRolesSelectedIds(next)
          },
        }}
        renderCell={(r, col) => {
          if (col.key === 'name') return roleLabel(r.name)
          if (col.key === 'actions') {
            return (
              <>
                <button
                  className={`${formStyles.btn} ${formStyles.btnSecondary}`}
                  type="button"
                  onClick={() => editRole(r.id, r.name)}
                  style={{ marginRight: '0.4rem' }}
                >
                  {t('common.edit')}
                </button>
                <button className={`${formStyles.btn} ${formStyles.btnSecondary}`} type="button" onClick={() => deleteRole(r.id)}>
                  {t('common.delete')}
                </button>
              </>
            )
          }
          return null
        }}
        page={1}
        pageCount={1}
        total={sortedRoles.length}
        onPageChange={() => {}}
        pageSize={sortedRoles.length || 1}
        onPageSizeChange={undefined}
        disabled={loading}
      />

      <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`} style={{ marginTop: '1rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortHeader className={styles.sortableHeader} label={t('rolesAccess.resource')} sortKey="resource" activeKey={resourcesSort.key} sortDir={resourcesSort.dir} onToggle={toggleResourcesSort} />
              {sortedRoles.map((r) => (
                <th key={r.id}>{roleLabel(r.name)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedResources.map((resource) => (
              <tr key={resource}>
                <td>{resourceLabel(resource)}</td>
                {sortedRoles.map((r) => (
                  <td key={`${resource}-${r.id}`}>
                    <label style={{ display: 'block' }}>
                      <input
                        type="checkbox"
                        checked={(policy[resource]?.read || []).includes(r.name)}
                        onChange={() => togglePermission(resource, r.name, 'read')}
                      />{' '}
                      {t('rolesAccess.read')}
                    </label>
                    <label style={{ display: 'block' }}>
                      <input
                        type="checkbox"
                        checked={(policy[resource]?.write || []).includes(r.name)}
                        onChange={() => togglePermission(resource, r.name, 'write')}
                      />{' '}
                      {t('rolesAccess.write')}
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <div className={formStyles.error}>{error}</div> : null}
      <div className={formStyles.actions}>
        <button className={`${formStyles.btn} ${formStyles.btnPrimary}`} type="button" disabled={saving || loading} onClick={savePolicy}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
      </ListPageDataPanel>
    </div>
  )
}
