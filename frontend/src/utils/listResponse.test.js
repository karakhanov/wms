import { describe, it, expect } from 'vitest'
import { normalizeListResponse, totalPages } from './listResponse'

describe('listResponse', () => {
  it('totalPages returns at least one page', () => {
    expect(totalPages(0, 10)).toBe(1)
    expect(totalPages(25, 10)).toBe(3)
    expect(totalPages(1, 10)).toBe(1)
    expect(totalPages(10, 10)).toBe(1)
  })

  it('normalizeListResponse accepts DRF shape or array', () => {
    expect(normalizeListResponse({ results: [{ id: 1 }], count: 99 })).toEqual({
      results: [{ id: 1 }],
      count: 99,
    })
    expect(normalizeListResponse([1, 2])).toEqual({ results: [1, 2], count: 2 })
  })
})
