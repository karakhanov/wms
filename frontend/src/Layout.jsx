import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './auth'
import { notifications as notificationsApi, users as usersApi } from './api'
import { APP_VERSION, BRAND_LOGO_URL } from './siteConfig'
import {
  canViewSidebar,
  canViewConstructionObjects,
  canViewIssueNotes,
  canViewNotifications,
  canViewHistory,
  canManageRoles,
  canViewReports,
  canViewUsers,
} from './permissions'
import ThemeToggle from './ThemeToggle'
import LanguageSelect from './components/LanguageSelect'
import { IconChevronLeft, IconChevronRight, IconLogout, IconNav } from './ui/Icons'
import styles from './Layout.module.css'

const navKeys = [
  { to: '/', key: 'dashboard', icon: 'dashboard' },
  { to: '/products', key: 'products', icon: 'products' },
  { to: '/categories', key: 'categories', icon: 'categories' },
  { to: '/warehouse', key: 'warehouse', icon: 'warehouse' },
  { to: '/objects', key: 'objects', icon: 'warehouse', can: canViewConstructionObjects },
  { to: '/suppliers', key: 'suppliers', icon: 'suppliers' },
  { to: '/receipts', key: 'receipts', icon: 'receipts' },
  { to: '/orders', key: 'orders', icon: 'orders' },
  { to: '/issue-notes', key: 'issueNotes', icon: 'receipts', can: canViewIssueNotes },
  { to: '/stock', key: 'stock', icon: 'stock' },
  { to: '/transfers', key: 'transfers', icon: 'transfers' },
  { to: '/inventory', key: 'inventory', icon: 'inventory' },
  { to: '/reports', key: 'reports', icon: 'reports', can: canViewReports },
  { to: '/users', key: 'users', icon: 'users', can: canViewUsers },
  { to: '/roles-access', key: 'rolesAccess', icon: 'users', can: canManageRoles },
  { to: '/notifications', key: 'notifications', icon: 'notifications', can: canViewNotifications },
  { to: '/history', key: 'history', icon: 'reports', can: canViewHistory },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()
  const lastTrackedRef = useRef('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('layout.sidebarCollapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const displayName = user?.username || user?.full_name || t('common.none')

  const visibleNav = navKeys.filter((item) =>
    canViewSidebar(user, item.key, () => (!item.can || item.can(user)))
  )

  const pullUnreadCount = useCallback(async () => {
    if (!canViewNotifications(user)) {
      setUnreadCount(0)
      return
    }
    try {
      const data = await notificationsApi.unreadCount()
      setUnreadCount(Number(data?.count || 0))
    } catch {
      setUnreadCount(0)
    }
  }, [user])

  useEffect(() => {
    if (!canViewNotifications(user)) {
      setUnreadCount(0)
      return () => {}
    }
    pullUnreadCount()
    const timer = setInterval(pullUnreadCount, 30000)
    return () => {
      clearInterval(timer)
    }
  }, [user, pullUnreadCount])

  useEffect(() => {
    const onNotificationsChanged = () => {
      pullUnreadCount()
    }
    window.addEventListener('notifications:changed', onNotificationsChanged)
    return () => {
      window.removeEventListener('notifications:changed', onNotificationsChanged)
    }
  }, [pullUnreadCount])

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search || ''}`
    if (!user?.id || !pagePath) return
    if (lastTrackedRef.current === pagePath) return
    lastTrackedRef.current = pagePath
    usersApi.activity({ page_path: pagePath, page_title: document.title || '' }).catch(() => {})
  }, [location.pathname, location.search, user?.id])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, location.search])

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('layout.sidebarCollapsed', next ? '1' : '0')
      } catch {
        /* ignore storage errors */
      }
      return next
    })
  }

  return (
    <div className={`${styles.layout} ${sidebarCollapsed ? styles.layoutCollapsed : ''}`}>
      {mobileMenuOpen ? <button type="button" className={styles.sidebarBackdrop} onClick={() => setMobileMenuOpen(false)} aria-label={t('common.closeDialog')} /> : null}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${mobileMenuOpen ? styles.mobileSidebarOpen : ''}`}>
        <Link to="/" className={styles.brand} title={t('app.title')}>
          <img src={BRAND_LOGO_URL} alt="" className={styles.brandLogo} />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {visibleNav.map(({ to, key, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
              end={to === '/'}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className={styles.navIcon}>
                <IconNav name={icon} size={19} />
              </span>
              <span className={styles.navLabelWrap}>
                <span className={styles.navLabel}>{t(`nav.${key}`)}</span>
                {key === 'notifications' && unreadCount > 0 ? (
                  <span className={styles.navBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                ) : null}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterInfo}>
            <div className={styles.sidebarFooterTitle}>{t('app.title')}</div>
            <div className={styles.sidebarFooterSub}>{t('app.subtitle')}</div>
            <div className={styles.sidebarFooterVersion}>{t('layout.version', { version: APP_VERSION })}</div>
            <div className={styles.sidebarFooterHint}>{t('layout.sidebarHint')}</div>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={t('common.menu')}
              aria-expanded={mobileMenuOpen}
            >
              ☰
            </button>
            <button
              type="button"
              className={styles.topbarCollapseBtn}
              onClick={toggleSidebar}
              aria-label={t('common.toggleSidebar')}
            >
              {sidebarCollapsed ? <IconChevronRight size={17} /> : <IconChevronLeft size={17} />}
            </button>
          </div>
          <div className={styles.topbarActions}>
            <LanguageSelect />
            <ThemeToggle />
            {canViewNotifications(user) && (
              <Link to="/notifications" className={styles.notificationsBtn} title={t('notifications.title')}>
                <IconNav name="notifications" size={18} />
                {unreadCount > 0 ? <span className={styles.notificationsBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
              </Link>
            )}

            <div className={styles.topbarUser} title={t('common.profile')}>
              <span className={styles.profileAvatar} aria-hidden>
                {(displayName || '?').trim().charAt(0).toUpperCase()}
              </span>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{displayName}</span>
                <button type="button" onClick={logout} className={styles.logout}>
                  <IconLogout size={14} className={styles.logoutIcon} />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
