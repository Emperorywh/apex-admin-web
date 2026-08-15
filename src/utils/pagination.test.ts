import { describe, expect, test } from 'vitest'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@/constants/request.constants'
import { normalizePagination } from './pagination'

describe('normalizePagination', () => {
  test('合法正整数 page/size 原样保留', () => {
    expect(normalizePagination({ page: 2, size: 20 })).toEqual({ page: 2, size: 20 })
  })

  test('未传参数回退默认值 page=1、size=10', () => {
    expect(normalizePagination({})).toEqual({ page: PAGE_DEFAULT, size: PAGE_SIZE_DEFAULT })
  })

  test('undefined 与 null 回退默认值', () => {
    expect(normalizePagination({ page: undefined, size: null })).toEqual({
      page: PAGE_DEFAULT,
      size: PAGE_SIZE_DEFAULT,
    })
  })

  test('NaN、小数、0 与负数 page 回退 PAGE_DEFAULT', () => {
    for (const page of [Number.NaN, 1.5, 0, -1]) {
      expect(normalizePagination({ page, size: 20 }).page).toBe(PAGE_DEFAULT)
    }
  })

  test('NaN、小数、0 与负数 size 回退 PAGE_SIZE_DEFAULT', () => {
    for (const size of [Number.NaN, 2.5, 0, -10]) {
      expect(normalizePagination({ page: 3, size }).size).toBe(PAGE_SIZE_DEFAULT)
    }
  })

  test('size 超过上限截断为 PAGE_SIZE_MAX', () => {
    expect(normalizePagination({ page: 1, size: PAGE_SIZE_MAX + 1 }).size).toBe(PAGE_SIZE_MAX)
  })

  test('size 恰等于上限时保留', () => {
    expect(normalizePagination({ page: 1, size: PAGE_SIZE_MAX })).toEqual({
      page: 1,
      size: PAGE_SIZE_MAX,
    })
  })
})
