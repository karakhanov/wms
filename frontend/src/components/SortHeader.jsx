/** @param {{ showInactiveHint?: boolean }} props — нейтральный ⇅ у неактивных колонок */
export default function SortHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onToggle,
  className,
  showInactiveHint = false,
}) {
  const active = activeKey === sortKey
  const arrow = active ? (sortDir === 'asc' ? '↑' : '↓') : showInactiveHint ? '⇅' : ''
  return (
    <button
      type="button"
      className={className}
      onClick={() => onToggle(sortKey)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {arrow ? (
        <>
          {' '}
          <span aria-hidden>
            {arrow}
          </span>
        </>
      ) : null}
    </button>
  )
}
