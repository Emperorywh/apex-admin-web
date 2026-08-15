import { describe, expect, test } from 'vitest'
import { DASHBOARD_DATE_FORMAT, DASHBOARD_ENDPOINTS } from './dashboard.constants'

describe('dashboard.constants', () => {
  test('概览接口路径与 §14.3 一致', () => {
    expect(DASHBOARD_ENDPOINTS.OVERVIEW).toBe('/dashboard/overview')
  })

  test('图表日期格式为 YYYY-MM-DD（§14.1）', () => {
    expect(DASHBOARD_DATE_FORMAT).toBe('YYYY-MM-DD')
  })
})
