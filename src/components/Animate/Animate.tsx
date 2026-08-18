/**
 * motion 统一封装（SPEC_UI2 §10）：业务代码只消费本组件与 Animate.variants.ts
 * 的变体，不散落 motion API；prefers-reduced-motion 经 MotionConfig reducedMotion="user"
 * 全局降级（motion 入场同样受降级约束）。
 *
 * 使用边界（红线）：仅错误页/登录页入场编排与组件级微动效；
 * PageCacheHost 下的 Activity 缓存页面禁止挂载入场动效（隐藏页 Effect 被清理，
 * 重显时入场动画会重播/闪烁，主规格 §9）。
 */
import { MotionConfig, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Variants } from 'motion/react'
import { varStaggerContainer } from './Animate.variants'

export interface AnimateContainerProps {
  /** 子项级联间隔秒数（默认 0.06） */
  stagger?: number
  className?: string
  children: ReactNode
}

/** 入场编排容器：initial→animate 一次，子项经 variants 级联 */
export function AnimateContainer({ stagger = 0.06, className, children }: AnimateContainerProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        variants={varStaggerContainer(stagger)}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}

export interface AnimateItemProps {
  /** 子项变体（varFade/varSlideUp/varSlideLeft/varBounce，见 Animate.variants.ts） */
  variants: Variants
  className?: string
  children: ReactNode
}

/** 级联子项：variants 由 AnimateContainer 的 stagger 驱动 */
export function AnimateItem({ variants, className, children }: AnimateItemProps) {
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  )
}
