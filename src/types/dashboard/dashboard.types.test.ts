import { expectTypeOf, test } from 'vitest'
import type { DashboardOverview } from './dashboard.types'

test('DashboardOverview 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<DashboardOverview>().toEqualTypeOf<{
    stats: {
      userCount: number
      enabledUserCount: number
      roleCount: number
      todayLoginCount: number
    }
    loginTrend: Array<{ date: string; count: number }>
    userGrowth: Array<{ date: string; count: number }>
    roleDistribution: Array<{ roleName: string; count: number; percent: number }>
  }>()
})
