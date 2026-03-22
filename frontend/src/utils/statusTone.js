export function getStatusTone(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'neutral'

  const success = ['approved', 'shipped', 'completed', 'success', 'active', 'read', 'yes', 'true']
  const danger = ['rejected', 'cancelled', 'canceled', 'failed', 'error', 'inactive', 'no', 'false']
  const warning = [
    'submitted',
    'pending',
    'picking',
    'review',
    'in_review',
    'processing',
    'open',
    'await_ctrl_pick',
    'awaiting_controller',
    'awaiting_procurement',
    'procurement_active',
    'awaiting_release',
  ]
  const neutral = ['new', 'created', 'draft', 'unread']

  if (success.includes(raw)) return 'success'
  if (danger.includes(raw)) return 'danger'
  if (warning.includes(raw)) return 'warning'
  if (neutral.includes(raw)) return 'neutral'
  return 'neutral'
}
