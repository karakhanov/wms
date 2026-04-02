import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './auth'
import { notifications as notificationsApi, orders as ordersApi, users as usersApi } from './api'
import { normalizeListResponse } from './utils/listResponse'
import { BRAND_LOGO_URL } from './siteConfig'
import {
  canViewSidebar,
  canViewConstructionObjects,
  canViewIssueNotes,
  canViewNotifications,
  canViewHistory,
  canManageRoles,
  canViewReports,
  canViewUsers,
  isForeman,
} from './permissions'
import ThemeToggle from './ThemeToggle'
import LanguageSelect from './components/LanguageSelect'
import { IconChevronLeft, IconChevronRight, IconLogout, IconNav } from './ui/Icons'
import { getBreadcrumbItems } from './utils/appBreadcrumbs'
import styles from './Layout.module.css'

const navItems = [
  { to: '/', key: 'dashboard', icon: 'dashboard' },
  { to: '/products', key: 'products', icon: 'products' },
  { to: '/categories', key: 'categories', icon: 'categories' },
  { to: '/warehouse', key: 'warehouse', icon: 'warehouse' },
  { to: '/objects', key: 'objects', icon: 'warehouse', can: canViewConstructionObjects },
  { to: '/suppliers', key: 'suppliers', icon: 'suppliers' },
  { to: '/services', key: 'services', icon: 'suppliers' },
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
  { to: '/object-limits', key: 'objectLimits', icon: 'reports', can: canViewConstructionObjects, navNested: true },
  { to: '/object-types', key: 'objectTypes', icon: 'warehouse', can: canViewConstructionObjects, navNested: true },
]

const navGroups = [
  { key: 'group1', items: ['dashboard'] },
  { key: 'group2', items: ['products', 'services', 'categories', 'suppliers', 'warehouse', 'stock'] },
  { key: 'group3', items: ['objects', 'objectTypes', 'objectLimits'] },
  { key: 'group4', items: ['issueNotes', 'receipts', 'orders'] },
  { key: 'group5', items: ['transfers', 'inventory'] },
  { key: 'group6', items: ['reports'] },
  { key: 'group7', items: ['users', 'rolesAccess', 'history'] },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const lastTrackedRef = useRef('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [readyPickupCount, setReadyPickupCount] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('layout.sidebarCollapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState(() => ({
    group1: true,
    group2: true,
    group3: true,
    group4: true,
    group5: true,
    group6: true,
    group7: true,
  }))
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPreview, setNotifPreview] = useState([])
  const [notifPreviewLoading, setNotifPreviewLoading] = useState(false)
  const [notifPreviewError, setNotifPreviewError] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const notifWrapRef = useRef(null)
  const userMenuWrapRef = useRef(null)

  const displayName = user?.username || user?.full_name || t('common.none')
  const roleLabel = user?.role_display || user?.role_name || t('common.none')

  const breadcrumbCurrentLabel = useMemo(() => {
    const items = getBreadcrumbItems(location.pathname, t)
    return items.length ? items[items.length - 1].label : t('nav.dashboard')
  }, [location.pathname, t])

  const visibleNav = useMemo(
    () =>
      navItems.filter((item) =>
        canViewSidebar(user, item.key, () => (!item.can || item.can(user)))
      ),
    [user]
  )
  const visibleNavMap = useMemo(() => new Map(visibleNav.map((item) => [item.key, item])), [visibleNav])
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.map((key) => visibleNavMap.get(key)).filter(Boolean),
        }))
        .filter((group) => group.items.length > 0),
    [visibleNavMap]
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

  const pullReadyPickupCount = useCallback(async () => {
    if (!isForeman(user) || !canViewIssueNotes(user)) {
      setReadyPickupCount(0)
      return
    }
    try {
      const data = await ordersApi.issueNotes({ status: 'ready_pickup', page_size: 1 })
      setReadyPickupCount(Number(normalizeListResponse(data).count || 0))
    } catch {
      setReadyPickupCount(0)
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
    pullReadyPickupCount()
    const timer = setInterval(pullReadyPickupCount, 30000)
    return () => clearInterval(timer)
  }, [pullReadyPickupCount])

  useEffect(() => {
    const onIssueNotesChanged = () => {
      pullReadyPickupCount()
    }
    window.addEventListener('issue-notes:changed', onIssueNotesChanged)
    return () => window.removeEventListener('issue-notes:changed', onIssueNotesChanged)
  }, [pullReadyPickupCount])

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
    setNotifOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target)) setNotifOpen(false)
      if (userMenuWrapRef.current && !userMenuWrapRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setNotifOpen(false)
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggleNotifDropdown = useCallback(() => {
    setNotifOpen((prev) => {
      const next = !prev
      if (next && canViewNotifications(user)) {
        setNotifPreviewLoading(true)
        setNotifPreviewError(false)
        notificationsApi
          .list({ is_read: false, page_size: 10 })
          .then((d) => {
            setNotifPreview(normalizeListResponse(d).results || [])
            setNotifPreviewError(false)
          })
          .catch(() => {
            setNotifPreview([])
            setNotifPreviewError(true)
          })
          .finally(() => setNotifPreviewLoading(false))
      }
      return next
    })
  }, [user])

  const previewNotifTitle = (n) =>
    t(`notifications.templates.${n.type}.title`, {
      number: n?.payload?.number || n?.entity_id || '',
      object_name: n?.payload?.object_name || t('common.none'),
      defaultValue: n?.title || t('common.none'),
    })
  const previewNotifMessage = (n) =>
    t(`notifications.templates.${n.type}.message`, {
      number: n?.payload?.number || n?.entity_id || '',
      object_name: n?.payload?.object_name || t('common.none'),
      defaultValue: n?.message || '',
    })

  useEffect(() => {
    const activeItem = visibleNav.find((item) => {
      if (item.to === '/') return location.pathname === '/'
      return location.pathname.startsWith(item.to)
    })
    if (!activeItem) return
    const ownerGroup = navGroups.find((group) => group.items.includes(activeItem.key))
    if (!ownerGroup) return
    setOpenGroups((prev) => ({ ...prev, [ownerGroup.key]: true }))
  }, [location.pathname, visibleNav])

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
  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  return (
    <div className={`${styles.layout} ${sidebarCollapsed ? styles.layoutCollapsed : ''}`}>
      {mobileMenuOpen ? <button type="button" className={styles.sidebarBackdrop} onClick={() => setMobileMenuOpen(false)} aria-label={t('common.closeDialog')} /> : null}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${mobileMenuOpen ? styles.mobileSidebarOpen : ''}`}>
        <Link to="/" className={styles.brand} title={t('app.title')}>
          <img src={BRAND_LOGO_URL} alt="" className={styles.brandLogo} />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {visibleGroups.map((group) => {
            if (group.items.length === 1) {
              const { to, key, icon } = group.items[0]
              const navTo =
                key === 'issueNotes' && isForeman(user) && readyPickupCount > 0
                  ? '/issue-notes?status=ready_pickup'
                  : to
              const showPickupBadge = key === 'issueNotes' && isForeman(user) && readyPickupCount > 0
              return (
                <section key={group.key} className={styles.navGroup}>
                  <NavLink
                    to={navTo}
                    className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
                    end={to === '/'}
                    aria-label={t(`nav.${key}`)}
                    title={
                      showPickupBadge
                        ? `${t(`nav.${key}`)} · ${t('layout.readyPickupNavTitle', { count: readyPickupCount })}`
                        : t(`nav.${key}`)
                    }
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
                      {showPickupBadge ? (
                        <span className={styles.navBadgePickup}>
                          {readyPickupCount > 99 ? '99+' : readyPickupCount}
                        </span>
                      ) : null}
                    </span>
                  </NavLink>
                </section>
              )
            }

            const isOpen = sidebarCollapsed ? true : openGroups[group.key] !== false
            return (
              <section key={group.key} className={styles.navGroup}>
                {!sidebarCollapsed ? (
                  <button
                    type="button"
                    className={styles.navGroupTitle}
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isOpen}
                  >
                    <span>{t(`layout.navGroups.${group.key}`)}</span>
                    {isOpen ? <IconChevronLeft size={14} /> : <IconChevronRight size={14} />}
                  </button>
                ) : null}
                <div
                  className={`${styles.navSubmenu} ${isOpen ? styles.navSubmenuOpen : styles.navSubmenuClosed}`}
                  aria-hidden={!isOpen}
                >
                  {group.items.map(({ to, key, icon, navNested }) => {
                      const navTo =
                        key === 'issueNotes' && isForeman(user) && readyPickupCount > 0
                          ? '/issue-notes?status=ready_pickup'
                          : to
                      const showPickupBadge = key === 'issueNotes' && isForeman(user) && readyPickupCount > 0
                      return (
                        <NavLink
                          key={key}
                          to={navTo}
                          className={({ isActive }) =>
                            `${isActive ? styles.navActive : styles.navLink}${navNested ? ` ${styles.navLinkNested}` : ''}`
                          }
                          end={to === '/'}
                          aria-label={t(`nav.${key}`)}
                          title={
                            showPickupBadge
                              ? `${t(`nav.${key}`)} · ${t('layout.readyPickupNavTitle', { count: readyPickupCount })}`
                              : t(`nav.${key}`)
                          }
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
                            {showPickupBadge ? (
                              <span className={styles.navBadgePickup}>
                                {readyPickupCount > 99 ? '99+' : readyPickupCount}
                              </span>
                            ) : null}
                          </span>
                        </NavLink>
                      )
                  })}
                </div>
              </section>
            )
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterAvatar}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.sidebarFooterContent}>
            <div className={styles.sidebarFooterName}>{displayName}</div>
            <div className={styles.sidebarFooterRole}>{roleLabel}</div>
          </div>
          <Link to="/profile" className={styles.sidebarFooterSettings} title={t('layout.profileSettings')} onClick={() => setMobileMenuOpen(false)}>
            <IconNav name="settings" size={16} />
          </Link>
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
          <div className={styles.topbarBreadcrumbs}>
            <div className={styles.topbarBreadcrumbsDesk}>
              <div className={styles.topbarPageTitle}>{breadcrumbCurrentLabel}</div>
            </div>
            <div className={styles.topbarBreadcrumbsMobile}>{breadcrumbCurrentLabel}</div>
          </div>
          <div className={styles.topbarActions}>
            <LanguageSelect />
            <ThemeToggle />
            {isForeman(user) && canViewIssueNotes(user) && readyPickupCount > 0 ? (
              <Link
                to="/issue-notes?status=ready_pickup"
                className={styles.pickupBtn}
                title={t('layout.readyPickupTitle', { count: readyPickupCount })}
                aria-label={t('layout.readyPickupTitle', { count: readyPickupCount })}
              >
                <IconNav name="receipts" size={18} />
                <span className={styles.pickupBadge}>{readyPickupCount > 99 ? '99+' : readyPickupCount}</span>
              </Link>
            ) : null}
            {canViewNotifications(user) ? (
              <div className={styles.notifWrap} ref={notifWrapRef}>
                <button
                  type="button"
                  className={styles.notificationsBtn}
                  title={t('notifications.title')}
                  aria-label={t('layout.notificationsMenu')}
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  onClick={() => {
                    setUserMenuOpen(false)
                    toggleNotifDropdown()
                  }}
                >
                  <IconNav name="notifications" size={18} />
                  {unreadCount > 0 ? (
                    <span className={styles.notificationsBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <div className={styles.notifDropdown} role="menu">
                    {notifPreviewLoading ? (
                      <div className={styles.notifDropdownLoading}>{t('common.loading')}</div>
                    ) : notifPreviewError ? (
                      <div className={styles.notifDropdownEmpty}>{t('layout.notificationsLoadError')}</div>
                    ) : notifPreview.length === 0 ? (
                      <div className={styles.notifDropdownEmpty}>{t('layout.notificationsEmpty')}</div>
                    ) : (
                      notifPreview.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          role="menuitem"
                          className={styles.notifDropdownItem}
                          onClick={() => {
                            setNotifOpen(false)
                            navigate('/notifications')
                          }}
                        >
                          <span className={styles.notifItemTitle}>{previewNotifTitle(n)}</span>
                          {previewNotifMessage(n) ? (
                            <span className={styles.notifItemMeta}>{previewNotifMessage(n)}</span>
                          ) : null}
                          {n.created_at ? (
                            <span className={styles.notifItemMeta}>
                              {String(n.created_at).replace('T', ' ').slice(0, 16)}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                    <div className={styles.notifDropdownFooter}>
                      <Link to="/notifications" onClick={() => setNotifOpen(false)}>
                        {t('layout.notificationsViewAll')}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={`${styles.topbarUser} ${styles.userMenuWrap}`} ref={userMenuWrapRef}>
              <button
                type="button"
                className={styles.userMenuTrigger}
                aria-label={t('layout.userMenu')}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                onClick={() => {
                  setNotifOpen(false)
                  setUserMenuOpen((o) => !o)
                }}
              >
                <span className={styles.profileAvatar} aria-hidden>
                  {(displayName || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className={styles.userMenuChevron} aria-hidden>
                  ▾
                </span>
              </button>
              {userMenuOpen ? (
                <div className={styles.userDropdown} role="menu">
                  <div className={styles.userDropdownHead}>
                    <span className={styles.userDropdownName}>{displayName}</span>
                    <span className={styles.userDropdownRole}>{roleLabel}</span>
                  </div>
                  <Link to="/profile" className={styles.userDropdownLink} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    {t('layout.profileSettings')}
                  </Link>
                  <button type="button" className={styles.userDropdownLogout} role="menuitem" onClick={() => logout()}>
                    <IconLogout size={16} />
                    {t('common.logout')}
                  </button>
                </div>
              ) : null}
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
