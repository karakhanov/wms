import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Reports() {
  const { t } = useTranslation()
  const [shortage, setShortage] = useState([])
  const [popular, setPopular] = useState([])

  useEffect(() => {
    api.get('/reports/shortage/').then((r) => setShortage(r.data || [])).catch(() => {})
    api.get('/reports/popular/').then((r) => setPopular(r.data || [])).catch(() => {})
  }, [])

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('reports.title')}</h1>
      <p className={styles.lead}>{t('reports.lead')}</p>
      <h2 className={styles.h2}>{t('reports.shortage')}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('stock.product')}</th>
              <th>{t('reports.minQty')}</th>
              <th>{t('reports.current')}</th>
            </tr>
          </thead>
          <tbody>
            {shortage.map((s, i) => (
              <tr key={i}>
                <td>{s.product_sku} — {s.product_name}</td>
                <td>{s.min_quantity}</td>
                <td>{s.current}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className={styles.h2}>{t('reports.popular')}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('stock.product')}</th>
              <th>{t('reports.shipped')}</th>
            </tr>
          </thead>
          <tbody>
            {popular.map((p, i) => (
              <tr key={i}>
                <td>{p.product_sku} — {p.product_name}</td>
                <td>{p.total_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
