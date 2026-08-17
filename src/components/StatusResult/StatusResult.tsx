/**
 * 状态结果页（SPEC-UI §8）：403/404/500 错误页与路由错误边界的统一视觉载体——
 * 居中留白排版 + 主题色浅底徽章中的 Lucide 插画级图标 + 主题色状态码点缀。
 * 行为（重试/返回/退出登录）与文案完全由调用方注入，本组件只做呈现；
 * 颜色一律来自 antd CSS 变量（规格 §10.2），样式见 StatusResult.module.css。
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
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
    <div className={styles.statusResult}>
      <span className={styles.iconBadge} aria-hidden>
        <Icon size={40} strokeWidth={1.5} />
      </span>
      <span className={styles.statusCode}>{status}</span>
      <h2 className={styles.title}>{title}</h2>
      {subTitle !== undefined && subTitle !== null && <p className={styles.subTitle}>{subTitle}</p>}
      {extra !== undefined && extra !== null && <div className={styles.extra}>{extra}</div>}
    </div>
  )
}
