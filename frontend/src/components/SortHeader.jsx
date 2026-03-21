export default function SortHeader({ label, sortKey, activeKey, sortDir, onToggle, className }) {
  const suffix = activeKey === sortKey ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th className={className} onClick={() => onToggle(sortKey)}>
      {label}
      {suffix}
    </th>
  )
}
