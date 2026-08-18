/**
 * 状态结果页（SPEC_UI2 §9）：403/404/500 错误页与路由错误边界的统一视觉载体——
 * 居中留白排版 + 主题色浅底徽章中的 Lucide 插画级图标 + 主题色状态码点缀，
 * 加 motion bounce 入场（slash 错误页同款；这些页面均为非缓存路由，无 Activity 冲突，
 * §10 红线合规；prefers-reduced-motion 经 MotionConfig 全局降级）。
 * 行为（重试/返回/退出登录）与文案完全由调用方注入，本组件只做呈现；
 * 颜色一律来自 antd CSS 变量（规格 §10.2），样式见 StatusResult.module.css。
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AnimateContainer, AnimateItem } from '@/components/Animate/Animate'
import { varBounce, varFade, varSlideUp } from '@/components/Animate/Animate.variants'
import styles from './StatusResult.module.css'

export interface StatusResultProps {
  /** 插画级图标：以主题色浅底徽章呈现（主题色点缀） */
  icon: LucideIcon
  /** 状态码点缀（如 403/404/500），主题色小号字 */
  status: string
  /** 标题 */
  title: ReactNode
  /** 副标题/诊断说明 */
  subTitle?: ReactNode
  /** 操作区（按钮组） */
  extra?: ReactNode
}

export function StatusResult({ icon: Icon, status, title, subTitle, extra }: StatusResultProps) {
  return (
    <div className={styles.statusResult}>
      {/* motion bounce 入场（SPEC_UI2 §9）：徽章回弹，文案依次上滑淡入 */}
      <AnimateContainer className={styles.entrance}>
        <AnimateItem variants={varBounce()}>
          <span className={styles.iconBadge} aria-hidden>
            <Icon size={40} strokeWidth={1.5} />
          </span>
        </AnimateItem>
        <AnimateItem variants={varFade()}>
          <span className={styles.statusCode}>{status}</span>
        </AnimateItem>
        <AnimateItem variants={varSlideUp(12)}>
          <h2 className={styles.title}>{title}</h2>
        </AnimateItem>
        {subTitle !== undefined && subTitle !== null && (
          <AnimateItem variants={varSlideUp(12)}>
            <p className={styles.subTitle}>{subTitle}</p>
          </AnimateItem>
        )}
        {extra !== undefined && extra !== null && (
          <AnimateItem variants={varSlideUp(12)}>
            <div className={styles.extra}>{extra}</div>
          </AnimateItem>
        )}
      </AnimateContainer>
    </div>
  )
}
