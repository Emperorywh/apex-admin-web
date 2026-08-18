/**
 * Sparkline 迷你趋势图测试（SPEC_UI2 §8）：路径归一化（含空/单点/全等序列边界）
 * 与渲染（线性渐变面积 + 描边，颜色由调用方 CSS 变量注入）。
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline, buildSparklinePath } from './Sparkline'

describe('buildSparklinePath 路径归一化', () => {
  it('少于 2 个点返回 null', () => {
    expect(buildSparklinePath([], 96, 36)).toBeNull()
    expect(buildSparklinePath([5], 96, 36)).toBeNull()
  })

  it('折线/面积路径覆盖全部点且面积闭合到底边', () => {
    const result = buildSparklinePath([1, 3, 2, 5], 96, 36)
    expect(result).not.toBeNull()
    expect(result!.line.startsWith('M')).toBe(true)
    expect(result!.line.split('L')).toHaveLength(4)
    expect(result!.area.endsWith('Z')).toBe(true)
  })

  it('全等序列（极差为 0）按水平线处理不产生 NaN', () => {
    const result = buildSparklinePath([7, 7, 7], 96, 36)
    expect(result).not.toBeNull()
    expect(result!.line).not.toContain('NaN')
  })
})

describe('Sparkline 渲染', () => {
  it('渲染 svg 面积与描边两条 path，颜色经调用方注入', () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 6]} color="var(--ant-color-primary)" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(2)
    expect(paths[1].getAttribute('stroke')).toBe('var(--ant-color-primary)')
  })

  it('数据不足时不渲染', () => {
    const { container } = render(<Sparkline data={[1]} color="var(--ant-color-primary)" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
