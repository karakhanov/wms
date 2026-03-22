export function issueNoteStatusLabel(t, status, fallback = '') {
  const key = String(status || '').toLowerCase()
  const map = {
    submitted: 'issueNotes.submittedStatusLabel',
    awaiting_procurement: 'issueNotes.statusAwaitingProcurement',
    procurement_active: 'issueNotes.statusProcurementActive',
    await_ctrl_pick: 'issueNotes.statusAwaitCtrlPick',
    awaiting_controller: 'issueNotes.statusAwaitingController',
    awaiting_release: 'issueNotes.statusAwaitingRelease',
    approved: 'issueNotes.approvedStatusLabel',
    picking: 'issueNotes.statusPicking',
    ready_pickup: 'issueNotes.statusReadyPickup',
    received_foreman: 'issueNotes.statusReceivedForeman',
    rejected: 'issueNotes.rejectedStatusLabel',
  }
  if (map[key]) return t(map[key])
  return fallback || status || t('common.none')
}

export function orderStatusLabel(t, status, fallback = '') {
  const key = String(status || '').toLowerCase()
  if (key === 'created') return t('orders.statusCreated')
  if (key === 'picking') return t('orders.statusPicking')
  if (key === 'shipped') return t('orders.statusShipped')
  return fallback || status || t('common.none')
}
