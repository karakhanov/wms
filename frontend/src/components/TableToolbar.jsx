import { useTranslation } from 'react-i18next'
import styles from './TableToolbar.module.css'

/**
 * @param {{
 *   search: string,
 *   onSearchChange: (v: string) => void,
 *   searchPlaceholder?: string,
 *   onExport?: () => void,
 *   exportDisabled?: boolean,
 *   children?: React.ReactNode,
 * }} props
 */
export default function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  onExport,
  exportDisabled,
  children,
}) {
  const { t } = useTranslation()
  const ph = searchPlaceholder ?? t('common.searchPlaceholder')

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <input
          type="search"
          className={styles.search}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={ph}
          aria-label={ph}
        />
        {children}
      </div>
      {onExport && (
        <div className={styles.right}>
          <button
            type="button"
            className={styles.btnExport}
            onClick={onExport}
            disabled={exportDisabled}
          >
            {t('common.exportExcel')}
          </button>
        </div>
      )}
    </div>
  )
}
