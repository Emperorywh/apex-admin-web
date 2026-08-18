/**
 * motion 变体库（SPEC_UI2 §10）：统一封装 motion API，业务代码不散落 motion 细节。
 * 使用边界（红线）：仅 ① 错误页/登录页入场编排、② CSS 难以表达的组件级微动效；
 * hover/展开/选中等过渡一律纯 CSS；PageCacheHost 下的 Activity 缓存页面禁止挂载入场动效。
 * 时长 150–300ms、ease-out 为主；prefers-reduced-motion 经 MotionConfig reducedMotion="user"
 * 全局降级（见 Animate.tsx）。
 */
import type { Variants } from 'motion/react'

/** 统一缓出曲线（SPEC_UI2 §10：ease-out 为主） */
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** 淡入：opacity 0 → 1 */
export function varFade(duration = 0.24): Variants {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration, ease: EASE_OUT } },
  }
}

/** 上滑入场：translateY(distance) + 淡入 */
export function varSlideUp(distance = 16, duration = 0.28): Variants {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0, transition: { duration, ease: EASE_OUT } },
  }
}

/** 横向滑入（登录页品牌区）：translateX(-distance) + 淡入 */
export function varSlideLeft(distance = 24, duration = 0.28): Variants {
  return {
    initial: { opacity: 0, x: -distance },
    animate: { opacity: 1, x: 0, transition: { duration, ease: EASE_OUT } },
  }
}

/** bounce 入场（slash 错误页同款）：scale 回弹 + 淡入 */
export function varBounce(duration = 0.3): Variants {
  return {
    initial: { opacity: 0, scale: 0.86 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration, ease: [0.34, 1.56, 0.64, 1] },
    },
  }
}

/** 容器级联：子项按 stagger 间隔依次入场（配合 var* 子项变体使用） */
export function varStaggerContainer(stagger = 0.06, delayChildren = 0.04): Variants {
  return {
    initial: {},
    animate: { transition: { staggerChildren: stagger, delayChildren } },
  }
}
