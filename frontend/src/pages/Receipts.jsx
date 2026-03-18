import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Receipts() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/receipts/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('receipts.title')}</h1>
      <p className={styles.lead}>{t('receipts.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('receipts.id')}</th>
              <th>{t('receipts.date')}</th>
              <th>{t('receipts.employee')}</th>
              <th>{t('receipts.supplier')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.created_at?.slice(0, 10)}</td>
                <td>{r.created_by_username || t('common.none')}</td>
                <td>{r.supplier_name || t('common.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
