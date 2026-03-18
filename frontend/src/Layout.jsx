import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './auth'
import styles from './Layout.module.css'

const navKeys = [
  { to: '/', key: 'dashboard' },
  { to: '/products', key: 'products' },
  { to: '/categories', key: 'categories' },
  { to: '/warehouse', key: 'warehouse' },
  { to: '/suppliers', key: 'suppliers' },
  { to: '/receipts', key: 'receipts' },
  { to: '/orders', key: 'orders' },
  { to: '/stock', key: 'stock' },
  { to: '/transfers', key: 'transfers' },
  { to: '/inventory', key: 'inventory' },
  { to: '/reports', key: 'reports' },
  { to: '/users', key: 'users' },
]

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>{t('app.title')}</div>
        <nav className={styles.nav}>
          {navKeys.map(({ to, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
              end={to === '/'}
            >
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.langSwitch}>
          {['ru', 'uz', 'en'].map((lng) => (
            <button
              key={lng}
              type="button"
              className={i18n.language === lng ? styles.langActive : styles.langBtn}
              onClick={() => i18n.changeLanguage(lng)}
            >
              {t(`lang.${lng}`)}
            </button>
          ))}
        </div>
        <div className={styles.user}>
          <span>{user?.username || user?.full_name || t('common.none')}</span>
          <button type="button" onClick={logout} className={styles.logout}>{t('common.logout')}</button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
