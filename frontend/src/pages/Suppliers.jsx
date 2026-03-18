import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { suppliers as api } from '../api'
import { useAuth } from '../auth'
import { canManageSuppliers } from '../permissions'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

function getList(d) {
  return d?.results ?? d ?? []
}

export default function Suppliers() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', inn: '', contact: '' })
  const canManage = canManageSuppliers(user)

  const load = () => {
    api.list().then((d) => {
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
      load()
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data))
    }
  }

  const remove = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    api.delete(id).then(() => load()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

  if (loading) return <div className={styles.page}>{t('common.loading')}</div>

  return (
    <div className={styles.page}>
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

      {canManage && formOpen && (
        <form onSubmit={save} className={formStyles.form} style={{ marginBottom: '1rem' }}>
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
              <th>{t('suppliers.name')}</th>
              <th>{t('suppliers.inn')}</th>
              <th>{t('suppliers.contact')}</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.inn || t('common.none')}</td>
                <td>{s.contact || t('common.none')}</td>
                {canManage && (
                  <td className={styles.actions}>
                    <button type="button" className={styles.btnSm} onClick={() => openEdit(s)}>{t('common.edit')}</button>
                    <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => remove(s.id, s.name)}>
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
