import { useTranslation } from 'react-i18next'
import { APP_VERSION } from '../siteConfig'
import styles from './Table.module.css'

export default function About() {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('about.title')}</h1>
      <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: 1.55, maxWidth: 520, marginTop: 8 }}>
        {t('about.intro')}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 20 }}>{t('layout.version', { version: APP_VERSION })}</p>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 6, opacity: 0.92 }}>{t('layout.sidebarHint')}</p>
    </div>
  )
}
