import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { products as productsApi } from '../api'
import { useAuth } from '../auth'
import { canManageProducts } from '../permissions'
import styles from './Table.module.css'

function photoUrl(photo) {
  if (!photo) return null
  if (photo.startsWith('http')) return photo
  return `/${photo}`.replace(/^\/+/, '/')
}

export default function Products() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState({ results: [] })
  const [loading, setLoading] = useState(true)
  const canManage = canManageProducts(user)

  const load = () => {
    productsApi.list().then((r) => {
      setList(r)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = (id, name) => {
    if (!window.confirm(t('common.confirmDelete') + '\n' + name)) return
    productsApi.delete(id).then(() => load()).catch((e) => alert(e.response?.data?.detail || 'Error'))
  }

  if (loading) return <div className={styles.page}>{t('common.loading')}</div>

  const rows = list.results || list

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>{t('products.title')}</h1>
          <p className={styles.lead}>{t('products.lead')}</p>
        </div>
        {canManage && (
          <Link to="/products/new" className={styles.btnAdd}>
            {t('common.add')}
          </Link>
        )}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('common.photo')}</th>
              <th>{t('products.sku')}</th>
              <th>{t('products.name')}</th>
              <th>{t('products.barcode')}</th>
              <th>{t('products.category')}</th>
              <th>{t('products.unit')}</th>
              <th>{t('products.amount')}</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.photo ? (
                    <img src={photoUrl(p.photo)} alt="" className={styles.thumb} />
                  ) : (
                    <span className={styles.thumbPlaceholder}>—</span>
                  )}
                </td>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.barcode || t('common.none')}</td>
                <td>{p.category_name || t('common.none')}</td>
                <td>{p.unit}</td>
                <td>{p.amount}</td>
                {canManage && (
                  <td className={styles.actions}>
                    <button type="button" className={styles.btnSm} onClick={() => navigate(`/products/${p.id}/edit`)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => handleDelete(p.id, p.name)}>
                      {t('common.delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
