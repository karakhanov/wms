import { useTranslation } from 'react-i18next'
import { getPaginationPageNumbers } from '../utils/paginationPages'
import styles from './TableToolbar.module.css'

/**
 * @param {{
 *   page: number,
 *   pageCount: number,
 *   total: number,
 *   onPageChange: (p: number) => void,
 *   pageSize?: number,
 *   pageSizeOptions?: number[],
 *   onPageSizeChange?: (size: number) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function PaginationBar({
  page,
  pageCount,
  total,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  disabled,
}) {
  const { t } = useTranslation()
  const canPrev = page > 1
  const canNext = page < pageCount
  const pageNumbers = pageCount > 1 ? getPaginationPageNumbers(page, pageCount) : []

  return (
    <div className={styles.pagination}>
      <span className={styles.meta}>
        {t('common.totalRows', { count: total })}
        {pageCount > 1 ? ` · ${t('common.pageOf', { page, total: pageCount })}` : ''}
      </span>
      {onPageSizeChange ? (
        <select
          className={styles.filterSelect}
          value={String(pageSize || pageSizeOptions[0])}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          aria-label={t('common.rowsPerPage')}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {t('common.rowsPerPage')}: {opt}
            </option>
          ))}
        </select>
      ) : null}
      {pageCount > 1 && (
        <div className={styles.paginationPages}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={disabled || !canPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label={t('common.prevPage')}
          >
            ‹
          </button>
          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e-${idx}`} className={styles.pageEllipsis} aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`${styles.pageBtn} ${styles.pageNum} ${item === page ? styles.pageNumActive : ''}`}
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-label={t('common.pageNumber', { page: item })}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            className={styles.pageBtn}
            disabled={disabled || !canNext}
            onClick={() => onPageChange(page + 1)}
            aria-label={t('common.nextPage')}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
