import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styles from './Modal.module.css'

function stackClassName(stacked, styles) {
  if (!stacked) return ''
  const n = stacked === true ? 1 : stacked
  if (n === 1) return styles.overlayStack
  if (n === 2) return styles.overlayStack2
  if (n === 3) return styles.overlayStack3
  return styles.overlayStack
}

/**
 * @param {{ 
 *   open: boolean, 
 *   title: string, 
 *   children: React.ReactNode, 
 *   onClose: () => void, 
 *   footer?: React.ReactNode,
 *   wide?: boolean, 
 *   xwide?: boolean, 
 *   stacked?: boolean | number,
 *   size?: 'sm' | 'md' | 'lg',
 *   drawer?: boolean
 * }} props
 * stacked: true|1 — первый уровень поверх основной модалки; 2 и 3 — для глубокой вложенности (склад→зона→…).
 */
export default function Modal({ open, title, children, onClose, footer, wide = false, xwide = false, stacked = false, size = 'md', drawer = false }) {
  const { t } = useTranslation()
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass = size === 'sm' ? styles.panelSm : size === 'lg' ? styles.panelLg : ''

  return createPortal(
    <div
      className={`${styles.overlay} ${stackClassName(stacked, styles)}`.trim()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${styles.panel} ${wide ? styles.panelWide : ''} ${xwide ? styles.panelXWide : ''} ${sizeClass} ${drawer ? styles.panelDrawer : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.closeDialog')}>
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
