import { useTranslation } from 'react-i18next'
import PaginationBar from './PaginationBar'
import styles from './DataTable.module.css'

export default function DataTable({
  columns,
  rows,
  rowKey = 'id',
  renderCell,
  emptyText,
  page,
  pageCount,
  total,
  onPageChange,
  pageSize,
  onPageSizeChange,
  disabled,
}) {
  const { t } = useTranslation()

  return (
    <div className={styles.shell}>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rowNoCol}>№</th>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={styles.empty} colSpan={columns.length + 1}>
                  {emptyText || t('common.emptyList')}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey]
                return (
                  <tr key={key}>
                    <td className={styles.rowNoCol}>{(page - 1) * pageSize + index + 1}</td>
                    {columns.map((col) => (
                      <td key={`${key}-${col.key}`}>{renderCell(row, col)}</td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <PaginationBar
          page={page}
          pageCount={pageCount}
          total={total}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
