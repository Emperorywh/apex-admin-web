/**
 * OverviewCard 测试（规格 §14.2 统计卡）：标题翻译 key、数值渲染、图标与加载骨架。
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UsersRound } from 'lucide-react'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { OverviewCard } from './OverviewCard'

describe('OverviewCard（规格 §14.2）', () => {
  it('渲染标题（中文文案 key）、数值与图标', () => {
    const { container } = renderWithProviders(<OverviewCard title="用户总数" value={12} icon={UsersRound} />)
    expect(screen.getByText('用户总数')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // lucide 图标渲染为 svg
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('loading 时显示骨架占位，不显示数值', () => {
    renderWithProviders(<OverviewCard title="用户总数" value={12} icon={UsersRound} loading />)
    expect(screen.queryByText('12')).not.toBeInTheDocument()
    expect(document.querySelector('.ant-skeleton')).toBeInTheDocument()
  })

  it('loading 默认关闭：直接显示数值', () => {
    renderWithProviders(<OverviewCard title="角色数量" value={2} icon={UsersRound} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(document.querySelector('.ant-skeleton')).not.toBeInTheDocument()
  })
})
