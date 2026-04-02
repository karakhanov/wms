import { useTranslation } from 'react-i18next'
import {
  IllustrationReceipt,
  IllustrationSuccess,
  IllustrationOrders,
  IllustrationGeneric,
} from './EmptyStateIllustrations'
import formStyles from '../pages/Form.module.css'
import styles from './EmptyState.module.css'

/**
 * Пустое состояние списка: иллюстрация, заголовок, подсказка, опционально кнопка.
 * @param {{
 *   title?: string,
 *   hint?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 *   actionLink?: string,
 *   variant?: 'receipt' | 'success' | 'orders' | 'generic',
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export default function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
  actionLink,
  variant = 'generic',
  compact = false,
  className = '',
}) {
  const { t } = useTranslation()

  const illustrations = {
    receipt: <IllustrationReceipt />,
    success: <IllustrationSuccess />,
    orders: <IllustrationOrders />,
    generic: <IllustrationGeneric />,
  }

  const illustration = illustrations[variant] || illustrations.generic

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''} ${className}`.trim()} role="status">
      <div className={styles.illustration}>{illustration}</div>
      <h2 className={styles.title}>{title ?? t('common.noData')}</h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {onAction && actionLabel ? (
        <button
          type="button"
          className={`${formStyles.btn} ${formStyles.btnPrimary} ${styles.action}`}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
      {actionLink ? (
        <a href={actionLink} className={styles.actionLink}>
          {t('common.goTo')} →
        </a>
      ) : null}
    </div>
  )
}
