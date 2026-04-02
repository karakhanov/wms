import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import styles from './Table.module.css'
import formStyles from './Form.module.css'

export default function Profile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const displayName = user?.full_name || user?.username || '—'
  const role = user?.role_display || user?.role_name || t('common.none')
  const email = user?.email || t('common.none')

  return (
    <div className={styles.page}>
      <div className={formStyles.page} style={{ maxWidth: '36rem', margin: '0 auto' }}>
        <h1 className={formStyles.h1}>{t('nav.profilePage')}</h1>
        <p className={formStyles.lead}>{t('profile.lead')}</p>
        <dl style={{ display: 'grid', gap: '0.75rem', margin: '1rem 0 0' }}>
          <div>
            <dt style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{t('users.username')}</dt>
            <dd style={{ margin: '0.2rem 0 0' }}>{user?.username || '—'}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{t('profile.displayName')}</dt>
            <dd style={{ margin: '0.2rem 0 0' }}>{displayName}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{t('users.role')}</dt>
            <dd style={{ margin: '0.2rem 0 0' }}>{role}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Email</dt>
            <dd style={{ margin: '0.2rem 0 0' }}>{email}</dd>
          </div>
        </dl>
        <p style={{ marginTop: '1.25rem', fontSize: '0.88rem', color: 'var(--muted)' }}>{t('profile.contactAdmin')}</p>
        <Link to="/" className={`${formStyles.btn} ${formStyles.btnSecondary}`} style={{ marginTop: '1rem', display: 'inline-flex' }}>
          {t('common.back')}
        </Link>
      </div>
    </div>
  )
}
