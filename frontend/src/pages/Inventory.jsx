import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Inventory() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/inventory/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('inventory.title')}</h1>
      <p className={styles.lead}>{t('inventory.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('inventory.id')}</th>
              <th>{t('inventory.date')}</th>
              <th>{t('inventory.warehouse')}</th>
              <th>{t('inventory.completed')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>{i.created_at?.slice(0, 10)}</td>
                <td>{i.warehouse_name || t('common.none')}</td>
                <td>{i.is_completed ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
