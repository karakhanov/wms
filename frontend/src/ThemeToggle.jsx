import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toggleTheme } from './theme'
import styles from './ThemeToggle.module.css'

function IconSun() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/**
 * @param {{ className?: string }} props
 */
export default function ThemeToggle({ className = '' }) {
  const { t } = useTranslation()
  const [isLight, setIsLight] = useState(
    () => document.documentElement.dataset.theme === 'light',
  )

  const onClick = () => {
    setIsLight(toggleTheme() === 'light')
  }

  const label = isLight ? t('theme.switchToDark') : t('theme.switchToLight')

  return (
    <button
      type="button"
      className={`${styles.btn} ${className}`.trim()}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {isLight ? <IconMoon /> : <IconSun />}
    </button>
  )
}
