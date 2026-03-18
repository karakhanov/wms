import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Users() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/auth/users/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('users.title')}</h1>
      <p className={styles.lead}>{t('users.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('users.username')}</th>
              <th>{t('users.fullName')}</th>
              <th>{t('users.role')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name || t('common.none')}</td>
                <td>{u.role_display || t('common.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
