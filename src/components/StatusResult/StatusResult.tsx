/**
 * 状态结果页（SPEC-UI §8；SPEC_UI2 §9 加 motion 入场）：403/404/500 错误页与路由错误
 * 边界的统一视觉载体——居中留白排版 + 主题色浅底徽章中的 Lucide 插画级图标 +
 * 主题色状态码点缀；入场动效经 MotionDiv 统一封装（bounce 徽章 + 级联淡入，
 * SPEC_UI2 §10 受限边界内：错误页为 noCache 非 Activity 路由）。
 * 行为（重试/返回/退出登录）与文案完全由调用方注入，本组件只做呈现；
 * 颜色一律来自 antd CSS 变量（规格 §10.2），样式见 StatusResult.module.css。
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MotionDiv } from '@/components/MotionDiv/MotionDiv'
import { containerCascade, varBounce, varFade } from '@/components/MotionDiv/motionVariants'
import styles from './StatusResult.module.css'

export interface StatusResultProps {
  /** 插画级图标：以主题色浅底徽章呈现（SPEC-UI §8 主题色点缀） */
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
    <MotionDiv
      className={styles.statusResult}
      variants={containerCascade}
      initial="hidden"
      animate="visible"
    >
      <MotionDiv variants={varBounce}>
        <span className={styles.iconBadge} aria-hidden>
          <Icon size={40} strokeWidth={1.5} />
        </span>
      </MotionDiv>
      <MotionDiv variants={varFade}>
        <span className={styles.statusCode}>{status}</span>
      </MotionDiv>
      <MotionDiv variants={varFade}>
        <h2 className={styles.title}>{title}</h2>
      </MotionDiv>
      {subTitle !== undefined && subTitle !== null && (
        <MotionDiv variants={varFade}>
          <p className={styles.subTitle}>{subTitle}</p>
        </MotionDiv>
      )}
      {extra !== undefined && extra !== null && (
        <MotionDiv variants={varFade}>
          <div className={styles.extra}>{extra}</div>
        </MotionDiv>
      )}
    </MotionDiv>
  )
}
