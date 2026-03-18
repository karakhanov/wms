import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './Dashboard.module.css'

const blocks = [
  { to: '/products', titleKey: 'products', descKey: 'productsDesc' },
  { to: '/categories', titleKey: 'categories', descKey: 'productsDesc' },
  { to: '/warehouse', titleKey: 'warehouse', descKey: 'warehouseDesc' },
  { to: '/suppliers', titleKey: 'suppliers', descKey: 'receiptsDesc' },
  { to: '/receipts', titleKey: 'receipts', descKey: 'receiptsDesc' },
  { to: '/orders', titleKey: 'orders', descKey: 'ordersDesc' },
  { to: '/stock', titleKey: 'stock', descKey: 'stockDesc' },
  { to: '/transfers', titleKey: 'transfers', descKey: 'transfersDesc' },
  { to: '/inventory', titleKey: 'inventory', descKey: 'inventoryDesc' },
  { to: '/reports', titleKey: 'reports', descKey: 'reportsDesc' },
  { to: '/users', titleKey: 'users', descKey: 'usersDesc' },
]

export default function Dashboard() {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('dashboard.title')}</h1>
      <p className={styles.lead}>{t('dashboard.lead')}</p>
      <div className={styles.grid}>
        {blocks.map(({ to, titleKey, descKey }) => (
          <Link key={to} to={to} className={styles.card}>
            <h2 className={styles.cardTitle}>{t(`nav.${titleKey}`)}</h2>
            <p className={styles.cardDesc}>{t(`dashboard.${descKey}`)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
