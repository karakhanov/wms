import axios from 'axios'
import { storageGet, storageRemove } from './storage'

const baseURL = '/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = storageGet('wms_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['Accept-Language'] = storageGet('wms_lang', 'ru') || 'ru'
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      storageRemove('wms_token')
      storageRemove('wms_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const auth = {
  login: (username, password) =>
    api.post('/auth/token/', { username, password }).then((r) => r.data),
  refresh: (refresh) => api.post('/auth/token/refresh/', { refresh }).then((r) => r.data),
  logout: () => api.post('/auth/logout/').then((r) => r.data),
  me: () => api.get('/auth/me/').then((r) => r.data),
}

function productPayload(data) {
  const hasFile = data.photo && data.photo instanceof File
  if (hasFile) {
    const fd = new FormData()
    const keys = ['name', 'sku', 'barcode', 'category', 'unit', 'description', 'amount', 'is_active']
    keys.forEach((k) => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') fd.append(k, data[k])
    })
    fd.append('photo', data.photo)
    return fd
  }
  const { photo, ...rest } = data
  return rest
}

export const products = {
  list: (params) => api.get('/products/', { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}/`).then((r) => r.data),
  create: (data) => {
    const payload = productPayload(data)
    if (payload instanceof FormData) {
      return api.post('/products/', payload, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.post('/products/', payload).then((r) => r.data)
  },
  update: (id, data) => {
    const payload = productPayload(data)
    if (payload instanceof FormData) {
      return api.patch(`/products/${id}/`, payload, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch(`/products/${id}/`, payload).then((r) => r.data)
  },
  delete: (id) => api.delete(`/products/${id}/`),
  categories: (params) => api.get('/products/categories/', { params }).then((r) => r.data),
  units: (params) => api.get('/products/units/', { params }).then((r) => r.data),
  categoryCreate: (data) => api.post('/products/categories/', data).then((r) => r.data),
  categoryUpdate: (id, data) => api.patch(`/products/categories/${id}/`, data).then((r) => r.data),
  categoryDelete: (id) => api.delete(`/products/categories/${id}/`),
}

export const suppliers = {
  list: (params) => api.get('/receipts/suppliers/', { params }).then((r) => r.data),
  get: (id) => api.get(`/receipts/suppliers/${id}/`).then((r) => r.data),
  create: (data) => api.post('/receipts/suppliers/', data).then((r) => r.data),
  update: (id, data) => api.patch(`/receipts/suppliers/${id}/`, data).then((r) => r.data),
  delete: (id) => api.delete(`/receipts/suppliers/${id}/`),
}

export const warehouse = {
  warehouses: (params) => api.get('/warehouse/warehouses/', { params }).then((r) => r.data),
  warehouseCreate: (data) => api.post('/warehouse/warehouses/', data).then((r) => r.data),
  warehouseUpdate: (id, data) => api.patch(`/warehouse/warehouses/${id}/`, data).then((r) => r.data),
  zones: (params) => api.get('/warehouse/zones/', { params }).then((r) => r.data),
  zoneCreate: (data) => api.post('/warehouse/zones/', data).then((r) => r.data),
  racks: (params) => api.get('/warehouse/racks/', { params }).then((r) => r.data),
  rackCreate: (data) => api.post('/warehouse/racks/', data).then((r) => r.data),
  cells: (params) => api.get('/warehouse/cells/', { params }).then((r) => r.data),
  cellCreate: (data) => api.post('/warehouse/cells/', data).then((r) => r.data),
}

export const construction = {
  objects: (params) => api.get('/construction/objects/', { params }).then((r) => r.data),
  createObject: (data) => api.post('/construction/objects/', data).then((r) => r.data),
  updateObject: (id, data) => api.patch(`/construction/objects/${id}/`, data).then((r) => r.data),
}

export const receipts = {
  list: (params) => api.get('/receipts/', { params }).then((r) => r.data),
  create: (data) => api.post('/receipts/', data).then((r) => r.data),
  get: (id) => api.get(`/receipts/${id}/`).then((r) => r.data),
  suppliers: (params) => api.get('/receipts/suppliers/', { params }).then((r) => r.data),
}

export const orders = {
  list: (params) => api.get('/orders/', { params }).then((r) => r.data),
  create: (data) => api.post('/orders/', data).then((r) => r.data),
  get: (id) => api.get(`/orders/${id}/`).then((r) => r.data),
  update: (id, data) => api.patch(`/orders/${id}/`, data).then((r) => r.data),
  issueNotes: (params) => api.get('/orders/issue-notes/', { params }).then((r) => r.data),
  issueNoteNextNumber: () => api.get('/orders/issue-notes/next-number/').then((r) => r.data),
  issueNoteCreate: (data) => api.post('/orders/issue-notes/', data).then((r) => r.data),
  issueNoteGet: (id) => api.get(`/orders/issue-notes/${id}/`).then((r) => r.data),
  issueNoteUpdate: (id, data) => api.patch(`/orders/issue-notes/${id}/`, data).then((r) => r.data),
}

export const stock = {
  balances: (params) => api.get('/stock/balances/', { params }).then((r) => r.data),
  minLevels: (params) => api.get('/stock/min-levels/', { params }).then((r) => r.data),
}

export const transfers = {
  list: (params) => api.get('/transfers/', { params }).then((r) => r.data),
  create: (data) => api.post('/transfers/', data).then((r) => r.data),
}

export const inventory = {
  list: (params) => api.get('/inventory/', { params }).then((r) => r.data),
  create: (data) => api.post('/inventory/', data).then((r) => r.data),
  get: (id) => api.get(`/inventory/${id}/`).then((r) => r.data),
  apply: (id) => api.post(`/inventory/${id}/apply/`).then((r) => r.data),
}

export const reports = {
  /** Одним запросом: счётчики, последние приёмки/заказы, топ, нехватка (дашборд) */
  summary: () => api.get('/reports/summary/').then((r) => r.data),
  movement: (params) => api.get('/reports/movement/', { params }).then((r) => r.data),
  shortage: () => api.get('/reports/shortage/').then((r) => r.data),
  popular: (params) => api.get('/reports/popular/', { params }).then((r) => r.data),
  objectConsumption: (params) => api.get('/reports/object-consumption/', { params }).then((r) => r.data),
}

export const notifications = {
  list: (params) => api.get('/notifications/', { params }).then((r) => r.data),
  read: (id) => api.post(`/notifications/${id}/read/`).then((r) => r.data),
  readAll: () => api.post('/notifications/read-all/').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count/').then((r) => r.data),
}

export const users = {
  list: (params) => api.get('/auth/users/', { params }).then((r) => r.data),
  roles: () => api.get('/auth/roles/').then((r) => r.data),
  roleCreate: (data) => api.post('/auth/roles/', data).then((r) => r.data),
  roleUpdate: (id, data) => api.patch(`/auth/roles/${id}/`, data).then((r) => r.data),
  roleDelete: (id) => api.delete(`/auth/roles/${id}/`),
  permissionsMatrix: () => api.get('/auth/permissions/').then((r) => r.data),
  permissionsMatrixUpdate: (policy) => api.post('/auth/permissions/', { policy }).then((r) => r.data),
  create: (data) => api.post('/auth/users/', data).then((r) => r.data),
  update: (id, data) => api.patch(`/auth/users/${id}/`, data).then((r) => r.data),
  assignObjects: (id, assigned_objects) => api.post(`/auth/users/${id}/assign-objects/`, { assigned_objects }).then((r) => r.data),
  managers: () => api.get('/auth/managers/').then((r) => r.data),
  activity: (data) => api.post('/auth/activity/', data).then((r) => r.data),
  actionLog: (params) => api.get('/auth/action-log/', { params }).then((r) => r.data),
  actionLogFacets: () => api.get('/auth/action-log/facets/').then((r) => r.data),
}
