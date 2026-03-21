export function issueNoteStatusLabel(t, status, fallback = '') {
  const key = String(status || '').toLowerCase()
  if (key === 'submitted') return t('issueNotes.submittedStatusLabel')
  if (key === 'approved') return t('issueNotes.approvedStatusLabel')
  if (key === 'rejected') return t('issueNotes.rejectedStatusLabel')
  return fallback || status || t('common.none')
}

export function orderStatusLabel(t, status, fallback = '') {
  const key = String(status || '').toLowerCase()
  if (key === 'created') return t('orders.statusCreated')
  if (key === 'picking') return t('orders.statusPicking')
  if (key === 'shipped') return t('orders.statusShipped')
  return fallback || status || t('common.none')
}
