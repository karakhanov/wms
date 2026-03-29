import tableStyles from '../pages/Table.module.css'
import { getStatusTone } from '../utils/statusTone'

export default function StatusBadge({ value, toneValue }) {
  const tone = getStatusTone(toneValue ?? value)
  const cls =
    tone === 'success'
      ? tableStyles.statusSuccess
      : tone === 'danger'
        ? tableStyles.statusDanger
        : tone === 'info'
          ? tableStyles.statusInfo
          : tone === 'warning'
            ? tableStyles.statusWarning
            : tableStyles.statusNeutral
  return <span className={`${tableStyles.statusBadge} ${cls}`}>{value}</span>
}
