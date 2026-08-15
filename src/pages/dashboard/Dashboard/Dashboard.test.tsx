/**
 * Dashboard 页面测试（规格 §14.2/§15）：
 * 统计卡片区 + 三类图表容器初始化（echarts 实例标记）；加载中与失败重试分支。
 * useDashboard 以 mock 替换；图表走真实 useECharts（SVG renderer，jsdom 可渲染）。
 */
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { Dashboard } from './Dashboard'

const { useDashboardMock } = vi.hoisted(() => ({ useDashboardMock: vi.fn() }))

vi.mock('@/features/dashboard/hooks/useDashboard', () => ({
  useDashboard: useDashboardMock,
}))

const overviewFixture: DashboardOverview = {
  stats: { userCount: 12, enabledUserCount: 10, roleCount: 2, todayLoginCount: 7 },
  loginTrend: [
    { date: '2026-08-09', count: 3 },
    { date: '2026-08-10', count: 5 },
  ],
  userGrowth: [
    { date: '2026-08-09', count: 10 },
    { date: '2026-08-10', count: 12 },
  ],
  roleDistribution: [{ roleName: '演示管理员角色', count: 1, percent: 25 }],
}

describe('Dashboard 页面（规格 §14.2/§15）', () => {
  it('数据就绪：四张统计卡 + 三个图表容器均初始化 echarts 实例', () => {
    useDashboardMock.mockReturnValue({ overview: overviewFixture, loading: false, refresh: vi.fn() })
    renderWithProviders(<Dashboard />)

    // 统计卡：标题与数值成对断言（echarts SVG 轴标签也是文本，需按卡片作用域隔离）
    const statCard = (title: string) => within(screen.getByText(title).closest('.ant-card') as HTMLElement)
    expect(statCard('用户总数').getByText('12')).toBeInTheDocument()
    expect(statCard('启用用户').getByText('10')).toBeInTheDocument()
    expect(statCard('角色数量').getByText('2')).toBeInTheDocument()
    expect(statCard('今日登录').getByText('7')).toBeInTheDocument()

    // 三类图表面板标题
    expect(screen.getByText('登录趋势')).toBeInTheDocument()
    expect(screen.getByText('用户增长')).toBeInTheDocument()
    expect(screen.getByText('角色分布')).toBeInTheDocument()

    // 每个图表容器都被 echarts init 打上实例标记
    const charts = document.querySelectorAll('[role="img"][_echarts_instance_]')
    expect(charts).toHaveLength(3)
  })

  it('首次加载中：统计卡显示骨架，图表区显示 Spin', () => {
    useDashboardMock.mockReturnValue({ overview: null, loading: true, refresh: vi.fn() })
    renderWithProviders(<Dashboard />)
    expect(document.querySelectorAll('.ant-skeleton')).toHaveLength(4)
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
    expect(document.querySelectorAll('[_echarts_instance_]').length).toBe(0)
  })

  it('加载失败：显示空态与重试按钮，点击调用 refresh', async () => {
    const refresh = vi.fn()
    useDashboardMock.mockReturnValue({ overview: null, loading: false, refresh })
    renderWithProviders(<Dashboard />)
    expect(screen.getByText('概览数据加载失败')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
