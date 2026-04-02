import axios from 'axios'
import { storageGet, storageRemove } from './storage'

const baseURL = '/api'

const api = axios.create({
  baseURL,
  // Content-Type не задаём жёстко:
  // - для JSON Axios сам проставит application/json
  // - для FormData важно, чтобы Axios добавил boundary
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
  // Если явно передали photo: null — очищаем поле фото на сервере.
  if (data.photo === null) return { ...rest, photo: null }
  return rest
}

export const products = {
  list: (params) => api.get('/products/', { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}/`).then((r) => r.data),
  history: (id, params) => api.get(`/products/${id}/history/`, { params }).then((r) => r.data),
  create: (data) => {
    const payload = productPayload(data)
    if (payload instanceof FormData) {
      return api.post('/products/', payload).then((r) => r.data)
    }
    return api.post('/products/', payload).then((r) => r.data)
  },
  update: (id, data) => {
    const payload = productPayload(data)
    if (payload instanceof FormData) {
      return api.patch(`/products/${id}/`, payload).then((r) => r.data)
    }
    return api.patch(`/products/${id}/`, payload).then((r) => r.data)
  },
  delete: (id) => api.delete(`/products/${id}/`),
  categories: (params) => api.get('/products/categories/', { params }).then((r) => r.data),
  units: (params) => api.get('/products/units/', { params }).then((r) => r.data),
  categoryCreate: (data) => api.post('/products/categories/', data).then((r) => r.data),
  categoryUpdate: (id, data) => api.patch(`/products/categories/${id}/`, data).then((r) => r.data),
  categoryDelete: (id) => api.delete(`/products/categories/${id}/`),
  services: (params) => api.get('/products/services/', { params }).then((r) => r.data),
  serviceCreate: (data) => api.post('/products/services/', data).then((r) => r.data),
  serviceUpdate: (id, data) => api.patch(`/products/services/${id}/`, data).then((r) => r.data),
  serviceDelete: (id) => api.delete(`/products/services/${id}/`),
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
  _payload: (data) => {
    const hasFile = data?.photo instanceof File
    if (!hasFile) return data
    const fd = new FormData()
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v)
    })
    fd.append('photo', data.photo)
    return fd
  },
  objects: (params) => api.get('/construction/objects/', { params }).then((r) => r.data),
  objectGet: (id) => api.get(`/construction/objects/${id}/`).then((r) => r.data),
  createObject: (data) => api.post('/construction/objects/', construction._payload(data)).then((r) => r.data),
  updateObject: (id, data) => api.patch(`/construction/objects/${id}/`, construction._payload(data)).then((r) => r.data),
  deleteObject: (id) => api.delete(`/construction/objects/${id}/`),
  objectTypes: (params) => api.get('/construction/object-types/', { params }).then((r) => r.data),
  objectTypeGet: (id) => api.get(`/construction/object-types/${id}/`).then((r) => r.data),
  createObjectType: (data) => api.post('/construction/object-types/', construction._payload(data)).then((r) => r.data),
  updateObjectType: (id, data) => api.patch(`/construction/object-types/${id}/`, construction._payload(data)).then((r) => r.data),
  uploadObjectPhoto: (id, file) => {
    const fd = new FormData()
    fd.append('photo', file)
    return api.post(`/construction/objects/${id}/upload_photo/`, fd).then((r) => r.data)
  },
  uploadObjectTypePhoto: (id, file) => {
    const fd = new FormData()
    fd.append('photo', file)
    return api.post(`/construction/object-types/${id}/upload_photo/`, fd).then((r) => r.data)
  },
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
  issueNoteSendToProcurement: (id, data) =>
    api.post(`/orders/issue-notes/${id}/send-to-procurement/`, data).then((r) => r.data),
  issueNoteProcurementDecline: (id, data) =>
    api.post(`/orders/issue-notes/${id}/procurement-decline/`, data).then((r) => r.data),
  issueNoteProcurementProceed: (id) =>
    api.post(`/orders/issue-notes/${id}/procurement-proceed/`).then((r) => r.data),
  issueNoteGoodsArrived: (id) =>
    api.post(`/orders/issue-notes/${id}/goods-arrived/`).then((r) => r.data),
  issueNoteProcurementDetails: (id, data) => {
    const scan = data?.procurement_scan
    if (scan instanceof File) {
      const fd = new FormData()
      ;[
        'procurement_purchase_date',
        'procurement_amount',
        'procurement_quantity_note',
        'procurement_vehicle',
        'procurement_delivery_notes',
      ].forEach((k) => {
        if (data[k] !== undefined && data[k] !== null && data[k] !== '') fd.append(k, data[k])
      })
      if (data.procurement_supplier != null && data.procurement_supplier !== '') {
        fd.append('procurement_supplier', String(data.procurement_supplier))
      }
      if (Array.isArray(data.procurement_item_ids)) {
        fd.append('procurement_item_ids', JSON.stringify(data.procurement_item_ids))
      }
      fd.append('procurement_scan', scan)
      return api
        .post(`/orders/issue-notes/${id}/procurement-details/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data)
    }
    return api.post(`/orders/issue-notes/${id}/procurement-details/`, data).then((r) => r.data)
  },
  issueNoteAssignInspection: (id, body) =>
    api.post(`/orders/issue-notes/${id}/assign-inspection/`, body).then((r) => r.data),
  issueNoteControllerComplete: (id, { lines, filesByItemId }) => {
    const fd = new FormData()
    fd.append('lines', JSON.stringify(lines))
    const map = filesByItemId || {}
    Object.keys(map).forEach((itemId) => {
      const files = map[itemId]
      if (!Array.isArray(files)) return
      files.forEach((f) => {
        if (f instanceof File) fd.append(`photos_${itemId}`, f)
      })
    })
    return api
      .post(`/orders/issue-notes/${id}/controller-complete/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
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
  summary: (params) => api.get('/reports/summary/', { params }).then((r) => r.data),
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
  controllers: () => api.get('/auth/controllers/').then((r) => r.data),
  activity: (data) => api.post('/auth/activity/', data).then((r) => r.data),
  actionLog: (params) => api.get('/auth/action-log/', { params }).then((r) => r.data),
  actionLogFacets: () => api.get('/auth/action-log/facets/').then((r) => r.data),
}
