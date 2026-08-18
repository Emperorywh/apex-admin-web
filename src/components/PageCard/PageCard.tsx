/**
 * 页面骨架卡片（SPEC_UI2 §7 单卡片合并规范）：列表/表单页的统一外壳——
 * 标题区 + 搜索区 + 内容区放进同一张白色圆角卡片（12px 圆角、细边、
 * --app-shadow-card 浅阴影）；搜索区与内容区之间细分隔线；页面衬底为灰阶画布。
 * 列结构、查询字段、按钮级权限与交互由调用方页面承载，本组件只做节奏统一。
 * 颜色一律来自 var(--ant-*) 与 --app-shadow-card（色值纪律 SPEC_UI2 §4.3）。
 */
import type { ReactNode } from 'react'
import styles from './PageCard.module.css'

export interface PageCardProps {
  /** 页面标题（可选）：标题区 16px/600 */
  title?: ReactNode
  /** 标题区右侧操作位（可选） */
  extra?: ReactNode
  /** 搜索/工具栏区（可选）：与内容区之间细分隔线 */
  search?: ReactNode
  /** 内容区：表格/表单等 */
  children: ReactNode
}

export function PageCard({ title, extra, search, children }: PageCardProps) {
  return (
    <section className={styles.pageCard}>
      {(title !== undefined || extra !== undefined) && (
        <header className={styles.header}>
          {title !== undefined && <h3 className={styles.title}>{title}</h3>}
          {extra !== undefined && <div className={styles.extra}>{extra}</div>}
        </header>
      )}
      {search !== undefined && <div className={styles.search}>{search}</div>}
      <div className={styles.body}>{children}</div>
    </section>
  )
}
