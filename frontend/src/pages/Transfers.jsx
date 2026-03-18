import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Transfers() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/transfers/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('transfers.title')}</h1>
      <p className={styles.lead}>{t('transfers.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('transfers.id')}</th>
              <th>{t('transfers.date')}</th>
              <th>{t('transfers.employee')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.created_at?.slice(0, 10)}</td>
                <td>{row.created_by_username || t('common.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
