/** Нормализация ответа DRF { count, results, next } или массива. */
export function normalizeListResponse(data) {
  if (Array.isArray(data)) {
    return { results: data, count: data.length }
  }
  const results = data?.results ?? []
  const count = data?.count ?? results.length
  return { results, count }
}

export function totalPages(count, pageSize) {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(0, Number(count) || 0) / pageSize))
}
