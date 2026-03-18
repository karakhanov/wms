import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Orders() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/orders/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('orders.title')}</h1>
      <p className={styles.lead}>{t('orders.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('orders.id')}</th>
              <th>{t('orders.date')}</th>
              <th>{t('orders.status')}</th>
              <th>{t('orders.client')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.created_at?.slice(0, 10)}</td>
                <td>{o.status_display || o.status}</td>
                <td>{o.client_name || t('common.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
