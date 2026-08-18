import { describe, expect, test } from 'vitest'
import { DASHBOARD_DATE_FORMAT } from './dashboard.constants'

describe('dashboard.constants', () => {
  test('图表日期格式为 YYYY-MM-DD（§14.1）', () => {
    expect(DASHBOARD_DATE_FORMAT).toBe('YYYY-MM-DD')
  })
})
