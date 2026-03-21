/**
 * Экспорт таблицы в CSV с BOM UTF-8 (корректно открывается в Excel).
 * Разделитель «;» — удобнее для русской локали Excel.
 */
export function downloadCsv(filename, headerLabels, rows) {
  const sep = ';'
  const esc = (v) => {
    if (v == null || v === undefined) return ''
    const s = String(v)
    if (/["\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const BOM = '\uFEFF'
  const lines = [
    headerLabels.map(esc).join(sep),
    ...rows.map((row) => row.map(esc).join(sep)),
  ]
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const name = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
