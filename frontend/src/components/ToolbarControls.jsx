import { useEffect, useMemo, useState } from 'react'
import panelStyles from '../pages/DataPanelLayout.module.css'

/**
 * Поле поиска в тулбаре списков (ширина задаётся обёрткой filterToolbarSearch).
 * @param {import('react').InputHTMLAttributes<HTMLInputElement> & {
 *   className?: string,
 *   onClear?: () => void,
 *   debounceMs?: number,
 *   onDebouncedValueChange?: (value: string) => void,
 * }} props
 */
export function ToolbarSearchInput({
  className = '',
  onClear,
  debounceMs = 350,
  onDebouncedValueChange,
  value,
  defaultValue,
  onChange,
  ...props
}) {
  const isControlled = value !== undefined
  const [innerValue, setInnerValue] = useState(defaultValue ?? '')
  const currentValue = useMemo(() => String(isControlled ? value ?? '' : innerValue ?? ''), [isControlled, value, innerValue])

  useEffect(() => {
    if (typeof onDebouncedValueChange !== 'function') return undefined
    const timer = setTimeout(() => onDebouncedValueChange(currentValue), debounceMs)
    return () => clearTimeout(timer)
  }, [currentValue, debounceMs, onDebouncedValueChange])

  const handleChange = (e) => {
    if (!isControlled) setInnerValue(e.target.value)
    if (typeof onChange === 'function') onChange(e)
  }

  const handleClear = () => {
    if (typeof onClear === 'function') {
      onClear()
      return
    }
    if (!isControlled) setInnerValue('')
    if (typeof onChange === 'function') {
      onChange({ target: { value: '' }, currentTarget: { value: '' } })
    }
  }

  return (
    <div className={panelStyles.toolbarSearchShell}>
      <span className={panelStyles.toolbarSearchIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M10.5 3.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.15 10.74 3.1 3.11-1.41 1.41-3.11-3.1 1.42-1.42Z" />
        </svg>
      </span>
      <input
        type="search"
        className={`${panelStyles.toolbarControl} ${panelStyles.toolbarSearchInput} ${className}`.trim()}
        value={isControlled ? value ?? '' : innerValue}
        onChange={handleChange}
        {...props}
      />
      {currentValue ? (
        <button
          type="button"
          className={panelStyles.toolbarSearchClear}
          onClick={handleClear}
          aria-label="Clear search"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  )
}

/**
 * Единый стиль select для фильтров (категория, статус, период и т.д.).
 * @param {import('react').SelectHTMLAttributes<HTMLSelectElement> & { className?: string }} props
 */
export function ToolbarFilterSelect({ className = '', ...props }) {
  return <select className={`${panelStyles.toolbarControl} ${panelStyles.toolbarFilterSelect} ${className}`.trim()} {...props} />
}

/**
 * Поле даты в той же визуальной системе, что поиск и селекты.
 * @param {import('react').InputHTMLAttributes<HTMLInputElement> & { className?: string }} props
 */
export function ToolbarFilterDateInput({ className = '', ...props }) {
  return <input className={`${panelStyles.toolbarControl} ${panelStyles.toolbarFilterDate} ${className}`.trim()} {...props} />
}
