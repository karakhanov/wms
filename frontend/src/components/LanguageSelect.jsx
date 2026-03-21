import { useTranslation } from 'react-i18next'
import { LANGUAGES, resolveLang } from '../i18nLanguages'
import styles from './LanguageSelect.module.css'

const LANG_FLAGS = { ru: '🇷🇺', uz: '🇺🇿', en: '🇬🇧' }
const LANG_SHORT = { ru: 'RU', uz: 'UZ', en: 'EN' }

/**
 * @param {{ className?: string }} props
 */
export default function LanguageSelect({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = resolveLang(i18n.language)

  return (
    <div className={`${styles.wrap} ${className}`.trim()}>
      <select
        className={styles.select}
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label={t('common.language')}
        title={`${t('common.language')}: ${t(`lang.${current}`)}`}
      >
        {LANGUAGES.map((lng) => (
          <option key={lng} value={lng} title={t(`lang.${lng}`)}>
            {LANG_FLAGS[lng]} {LANG_SHORT[lng]}
          </option>
        ))}
      </select>
    </div>
  )
}
