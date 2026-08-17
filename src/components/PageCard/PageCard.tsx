/**
 * 页面单卡片骨架（SPEC_UI2 §7）：搜索区 + 工具栏 + 表格/内容合并进同一张
 * 纸面白卡（12px 圆角、细边、柔和浅阴影），搜索区与内容区之间细分隔线；
 * 页面衬底为灰阶画布（BasicLayout 内容区）。列表页统一套用，标题区/搜索区/
 * 内容区节奏由本组件收敛；列结构、查询字段与交互由各页面自持，零侵入。
 */
import type { ReactNode } from 'react'
import styles from './PageCard.module.css'

export interface PageCardProps {
  /** 标题区文案（可选；不传则不渲染标题行） */
  title?: ReactNode
  /** 标题区右侧附加区（操作按钮等，可选） */
  extra?: ReactNode
  /** 搜索/工具栏区（可选）：与内容区之间以细分隔线相隔（SPEC_UI2 §7） */
  search?: ReactNode
  /** 内容区：表格/表单等页面主体 */
  children: ReactNode
}

export function PageCard({ title, extra, search, children }: PageCardProps) {
  return (
    <section className={styles.card}>
      {(title !== undefined || extra !== undefined) && (
        <header className={styles.header}>
          {title !== undefined && <h3 className={styles.title}>{title}</h3>}
          {extra !== undefined && <div className={styles.extra}>{extra}</div>}
        </header>
      )}
      {search !== undefined && <div className={styles.search}>{search}</div>}
      <div className={styles.content}>{children}</div>
    </section>
  )
}
