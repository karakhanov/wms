import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Stock() {
  const { t } = useTranslation()
  const [list, setList] = useState({ results: [] })

  useEffect(() => {
    api.get('/stock/balances/').then((r) => setList(r.data)).catch(() => {})
  }, [])

  const rows = list.results || list
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('stock.title')}</h1>
      <p className={styles.lead}>{t('stock.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('stock.product')}</th>
              <th>{t('stock.cell')}</th>
              <th>{t('stock.quantity')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.product_sku} — {b.product_name}</td>
                <td>{b.cell_name}</td>
                <td>{b.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
