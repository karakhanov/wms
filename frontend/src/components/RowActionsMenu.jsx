import { useRef, useState, useEffect } from 'react'
import { IconNav } from '../ui/Icons'
import styles from './RowActionsMenu.module.css'

/**
 * RowActionsMenu — всплывающее меню действий для строк таблицы
 * Отображается на конец строки как 3 точки (⋯)
 */
export default function RowActionsMenu({ onEdit, onDelete, itemName = '' }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)

  // Закрываем меню при клике вне
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleEdit = (e) => {
    e.stopPropagation()
    setOpen(false)
    onEdit?.()
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    setOpen(false)
    onDelete?.()
  }

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        type="button"
        className={styles.trigger}
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        title={`Menu for ${itemName}`}
        aria-label="Row actions"
      >
        <span className={styles.dots}>⋯</span>
      </button>

      {open && (
        <div className={styles.menu}>
          <button type="button" className={styles.menuItem} onClick={handleEdit}>
            <IconNav name="edit" size={16} />
            <span>Edit</span>
          </button>
          <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
            <IconNav name="trash" size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  )
}
