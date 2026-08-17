/**
 * 动效变体统一封装（SPEC_UI2 §10）：仿 slash varFade/varSlide/varBounce 变体 +
 * 容器级联；业务代码只从本模块与 MotionDiv 消费动效，不直接散落 motion API。
 *
 * 使用边界（红线，SPEC_UI2 §10）：
 * - 仅用于①错误页/登录页入场编排、②CSS 难以表达的组件级微动效；
 * - hover、展开/折叠、选中切换一律纯 CSS；卡片 hover 抬升禁用 motion；
 * - Activity 缓存页面（PageCacheHost 下）禁止挂载入场动效——隐藏页 Effect 被
 *   React 清理，重显时入场动画会重播/闪烁（主规格 §9）。
 * 时长 150–300ms、ease-out 为主；prefers-reduced-motion 降级由 MotionDiv 统一承接。
 */
import type { Variants } from 'motion/react'

/** 入场过渡时长，单位秒（SPEC_UI2 §10：150–300ms） */
const ENTRANCE_DURATION_S = 0.28

/** 容器级联的子项间隔，单位秒 */
const CASCADE_STAGGER_S = 0.08

/** 淡入 */
export const varFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: ENTRANCE_DURATION_S, ease: 'easeOut' } },
}

/** 淡入 + 上滑（登录页/卡片入场） */
export const varSlideInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: ENTRANCE_DURATION_S, ease: 'easeOut' } },
}

/** 弹跳入场（错误页徽章，SPEC_UI2 §9 slash 错误页同款） */
export const varBounce: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
}

/** 容器级联：子项按 CASCADE_STAGGER_S 依次入场（容器自身不变换） */
export const containerCascade: Variants = {
  hidden: { opacity: 1 },
  visible: { transition: { staggerChildren: CASCADE_STAGGER_S, delayChildren: 0.05 } },
}
