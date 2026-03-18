import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { products as api } from '../api'
import { useAuth } from '../auth'
import { canManageCategories } from '../permissions'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

function getList(d) {
  return d?.results ?? d ?? []
}

export default function Categories() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', parent: '' })
  const canManage = canManageCategories(user)

  const load = () => {
    api.categories().then((d) => {
      setList(getList(d))
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

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
      load()
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data))
    }
  }

  const remove = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    api.categoryDelete(id).then(() => load()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

  if (loading) return <div className={styles.page}>{t('common.loading')}</div>

  return (
    <div className={styles.page}>
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

      {canManage && formOpen && (
        <form onSubmit={save} className={formStyles.form} style={{ marginBottom: '1rem' }}>
          <div className={formStyles.row}>
            <label>{t('categories.name')} *</label>
            <input
              className={formStyles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className={formStyles.row}>
            <label>{t('categories.parent')}</label>
            <select
              className={formStyles.select}
              value={form.parent}
              onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}
            >
              <option value="">—</option>
              {list.filter((c) => c.id !== editing).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={formStyles.actions}>
            <button type="submit" className={`${formStyles.btn} ${formStyles.btnPrimary}`}>{t('common.save')}</button>
            <button type="button" className={`${formStyles.btn} ${formStyles.btnSecondary}`} onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('categories.name')}</th>
              <th>{t('categories.parent')}</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{list.find((x) => x.id === c.parent)?.name ?? t('common.none')}</td>
                {canManage && (
                  <td className={styles.actions}>
                    <button type="button" className={styles.btnSm} onClick={() => openEdit(c)}>{t('common.edit')}</button>
                    <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => remove(c.id, c.name)}>
                      {t('common.delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
