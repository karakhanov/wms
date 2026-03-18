import axios from 'axios'

const baseURL = '/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wms_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const lang = localStorage.getItem('wms_lang') || 'ru'
  config.headers['Accept-Language'] = lang
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wms_token')
      localStorage.removeItem('wms_user')
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
  zones: (params) => api.get('/warehouse/zones/', { params }).then((r) => r.data),
  racks: (params) => api.get('/warehouse/racks/', { params }).then((r) => r.data),
  cells: (params) => api.get('/warehouse/cells/', { params }).then((r) => r.data),
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
  movement: (params) => api.get('/reports/movement/', { params }).then((r) => r.data),
  shortage: () => api.get('/reports/shortage/').then((r) => r.data),
  popular: (params) => api.get('/reports/popular/', { params }).then((r) => r.data),
}

export const users = {
  list: (params) => api.get('/auth/users/', { params }).then((r) => r.data),
  roles: () => api.get('/auth/roles/').then((r) => r.data),
  actionLog: (params) => api.get('/auth/action-log/', { params }).then((r) => r.data),
}
