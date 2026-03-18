import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import styles from './Table.module.css'

export default function Warehouse() {
  const { t } = useTranslation()
  const [warehouses, setWarehouses] = useState([])

  useEffect(() => {
    api.get('/warehouse/warehouses/').then((r) => setWarehouses(r.data.results || r.data || []))
  }, [])

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('warehouse.title')}</h1>
      <p className={styles.lead}>{t('warehouse.lead')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('warehouse.name')}</th>
              <th>{t('warehouse.address')}</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.address || t('common.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
