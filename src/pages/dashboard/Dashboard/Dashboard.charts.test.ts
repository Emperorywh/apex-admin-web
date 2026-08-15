/**
 * Dashboard 图表 option 构建测试（规格 §14.2/§15）：
 * 三类图表的数据映射与 token 取色；颜色全部来自传入主题，不出现字面量色值
 * （本文件的色值仅作为测试夹具输入，规格 §10.2）。
 */
import { describe, expect, it } from 'vitest'
import type { GlobalToken } from 'antd'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import {
  buildDashboardChartTheme,
  buildLoginTrendOption,
  buildRoleDistributionOption,
  buildUserGrowthOption,
  type DashboardChartTheme,
} from './Dashboard.charts'

// 测试夹具色值（规格 §10.2 允许）：仅作为断言输入
const chartTheme: DashboardChartTheme = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorInfo: '#1677ff',
  colorError: '#ff4d4f',
  colorText: 'rgba(0,0,0,0.88)',
  colorTextDescription: 'rgba(0,0,0,0.45)',
  colorBorderSecondary: '#f0f0f0',
  colorBgContainer: '#ffffff',
}

const overview: DashboardOverview = {
  stats: { userCount: 12, enabledUserCount: 10, roleCount: 2, todayLoginCount: 7 },
  loginTrend: [
    { date: '2026-08-09', count: 3 },
    { date: '2026-08-10', count: 5 },
    { date: '2026-08-11', count: 4 },
  ],
  userGrowth: [
    { date: '2026-08-09', count: 10 },
    { date: '2026-08-10', count: 11 },
    { date: '2026-08-11', count: 12 },
  ],
  roleDistribution: [
    { roleName: '演示管理员角色', count: 1, percent: 25 },
    { roleName: '演示访客角色', count: 3, percent: 75 },
  ],
}

describe('buildDashboardChartTheme', () => {
  it('从 antd token 提取图表主题字段', () => {
    const token = chartTheme as unknown as Pick<GlobalToken, keyof DashboardChartTheme>
    expect(buildDashboardChartTheme(token)).toEqual(chartTheme)
  })
})

describe('buildLoginTrendOption（规格 §14.2 折线）', () => {
  it('类目轴为升序日期，系列为计数折线，颜色取 colorPrimary', () => {
    const option = buildLoginTrendOption(overview, chartTheme) as Record<string, never>
    const xAxis = option.xAxis as { data: string[] }
    expect(xAxis.data).toEqual(['2026-08-09', '2026-08-10', '2026-08-11'])
    const series = (option.series as Array<{ type: string; data: number[]; itemStyle: { color: string } }>)[0]
    expect(series.type).toBe('line')
    expect(series.data).toEqual([3, 5, 4])
    expect(series.itemStyle.color).toBe(chartTheme.colorPrimary)
  })
})

describe('buildUserGrowthOption（规格 §14.2 用户增长）', () => {
  it('类目轴为日期，系列为柱形，颜色取 colorInfo', () => {
    const option = buildUserGrowthOption(overview, chartTheme) as Record<string, never>
    const series = (option.series as Array<{ type: string; data: number[]; itemStyle: { color: string } }>)[0]
    expect(series.type).toBe('bar')
    expect(series.data).toEqual([10, 11, 12])
    expect(series.itemStyle.color).toBe(chartTheme.colorInfo)
  })
})

describe('buildRoleDistributionOption（规格 §14.2 饼/环）', () => {
  it('环形半径与图例就位；数据映射 roleName/count，颜色按 token 调色环循环', () => {
    const option = buildRoleDistributionOption(overview, chartTheme) as Record<string, never>
    const series = (option.series as Array<{
      type: string
      radius: string[]
      data: Array<{ name: string; value: number; itemStyle: { color: string } }>
    }>)[0]
    expect(series.type).toBe('pie')
    expect(series.radius).toEqual(['45%', '70%'])
    expect(series.data.map((item) => [item.name, item.value])).toEqual([
      ['演示管理员角色', 1],
      ['演示访客角色', 3],
    ])
    // 取色环从 colorPrimary 起，第二项取 colorSuccess
    expect(series.data[0].itemStyle.color).toBe(chartTheme.colorPrimary)
    expect(series.data[1].itemStyle.color).toBe(chartTheme.colorSuccess)
  })
})
