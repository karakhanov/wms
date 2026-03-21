import formStyles from '../pages/Form.module.css'

/**
 * Строка формы: label + select + опциональная кнопка «+» для быстрого создания связанной сущности.
 */
export default function FkSelectRow({ label, children, canAdd, onAdd, addTitle, addAriaLabel }) {
  return (
    <div className={formStyles.row}>
      <label>{label}</label>
      <div className={formStyles.fkRow}>
        {children}
        {canAdd && (
          <button
            type="button"
            className={formStyles.fkAddBtn}
            onClick={onAdd}
            title={addTitle}
            aria-label={addAriaLabel || addTitle}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
