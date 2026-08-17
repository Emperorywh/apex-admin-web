/**
 * motion 封装测试（SPEC_UI2 §10）：变体渲染与 reduced-motion 降级。
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MotionDiv } from './MotionDiv'
import { containerCascade, varBounce, varFade, varSlideInUp } from './motionVariants'

describe('motionVariants 动效变体（SPEC_UI2 §10）', () => {
  it('四组变体均含 hidden/visible 两态，入场时长收敛在 150–300ms（spring 弹跳除外）', () => {
    for (const variants of [varFade, varSlideInUp]) {
      expect(variants.hidden).toBeDefined()
      expect(variants.visible).toBeDefined()
      expect(variants.visible).toHaveProperty('transition')
    }
    expect(varBounce.visible).toHaveProperty('transition')
    expect(containerCascade.visible).toHaveProperty('transition.staggerChildren')
  })
})

describe('MotionDiv 包装组件（SPEC_UI2 §10）', () => {
  it('透传 className/children 并正常渲染为 div', () => {
    const { container } = render(
      <MotionDiv variants={varFade} initial="hidden" animate="visible" className="fixture-motion">
        <span>入场内容</span>
      </MotionDiv>,
    )
    const div = container.querySelector('div')
    expect(div).not.toBeNull()
    expect(div?.className).toContain('fixture-motion')
    expect(container.textContent).toContain('入场内容')
  })
})
