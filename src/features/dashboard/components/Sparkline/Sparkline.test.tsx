/**
 * 迷你趋势图测试（SPEC_UI2 §8）：折线路径派生与边界（点数不足/全等序列）。
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from './Sparkline'

describe('Sparkline 迷你趋势图（SPEC_UI2 §8）', () => {
  it('至少两点绘制折线与浅色填充区域', () => {
    const { container } = render(<Sparkline data={[0, 4, 2, 6]} width={100} height={40} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(2)
    expect(paths[0].getAttribute('d')).toContain('L')
    expect(paths[1].getAttribute('d')).toMatch(/^M /)
  })

  it('少于两点不渲染（无趋势可绘）', () => {
    const { container } = render(<Sparkline data={[3]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('全等序列画中线（值域跨度为 0 不除零）', () => {
    const { container } = render(<Sparkline data={[5, 5, 5]} width={100} height={40} />)
    const line = container.querySelectorAll('path')[1]
    expect(line.getAttribute('d')).toContain('20') // y = 2 + (40-4) * 0.5 = 20
  })

  it('装饰性图形对可访问性树隐藏', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
