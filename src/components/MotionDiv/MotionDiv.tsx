/**
 * motion 包装组件（SPEC_UI2 §10）：业务侧唯一动画容器入口——
 * 业务代码从本模块消费 <MotionDiv> + motionVariants 变体，不直接 import 'motion/react'。
 * prefers-reduced-motion 降级在此统一承接（全局降级机制见 globals.css，主规格 §11.3）：
 * 用户偏好减少动效时跳过初始隐藏态，元素直接以最终状态呈现。
 */
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'

export type MotionDivProps = HTMLMotionProps<'div'>

export function MotionDiv(props: MotionDivProps) {
  const prefersReducedMotion = useReducedMotion()
  if (prefersReducedMotion) {
    // initial={false}：跳过初始隐藏态与入场动画，直接呈现最终状态
    return <motion.div {...props} initial={false} />
  }
  return <motion.div {...props} />
}
