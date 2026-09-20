/**
 * 实时看板 KPI 卡（P34 私有纯展示组件；旧 DashboardShared KpiCard 等价迁移，
 * 视觉换用目标项目 CSS 变量体系——语义色随明暗主题由 globals.css 单源切换）。
 *
 * 视觉与可访问性：
 * - 标签 12px 次要色 + 前置图标 + 口径提示（KpiHint 键盘可达）；
 * - 主值 28px/700；环比 12px 按涨跌着色（上升红/下降绿/中性）；
 * - 强调边框：danger 故障告急（红）、warn 积压偏高（橙），3px 左边框；
 * - 首载 loading 用 Skeleton 占位，保持卡片高度防网格跳动；
 * - onOpen 提供时整卡可点击（Enter/Space 可触发，读屏 role=button）——
 *   仅用于「今日任务总数 → 任务管理」的合并首页导航契约（D29，旧系统无此交互，
 *   登记于 tasks/P34.md 与 contracts.md）。
 */

import { useState } from 'react'
import { Skeleton, Tooltip } from 'antd'
import { CircleHelp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { KpiViewModel } from '@/features/dashboard/kpiViewModel'
import styles from '@/features/dashboard/components/RealtimeKpiCard.module.css'

interface RealtimeKpiCardProps {
  /** 标签文案（已本地化） */
  label: string
  /** 标签前置图标（lucide，目标项目图标体系） */
  icon: LucideIcon
  /** 展示模型（kpiViewModel 纯函数产出） */
  value: KpiViewModel
  /** 口径说明（已本地化 ReactNode）；不传则不显示提示图标 */
  hint?: ReactNode
  /** 口径提示图标的可访问名称（已本地化） */
  hintLabel?: string
  /** 首载骨架 */
  loading?: boolean
  /** 强调边框语义：danger 故障告急 / warn 积压偏高（业务阈值由页面判定） */
  accent?: 'danger' | 'warn'
  /** 整卡导航回调（提供时整卡可点击）；无权限目标由页面侧不传 */
  onOpen?: () => void
}

/** 口径提示：图标 + Tooltip，键盘聚焦受控展示（P33 MetricHint 同款交互，域内私有） */
function KpiHint({ content, label }: { content: ReactNode; label: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <Tooltip
      placement="bottom"
      overlayInnerStyle={{ maxWidth: 320, whiteSpace: 'pre-line' }}
      mouseEnterDelay={0.2}
      open={focused ? true : undefined}
      onOpenChange={(open) => {
        if (!open && focused) setFocused(false)
      }}
      title={content}
    >
      <span
        className={styles.hintTrigger}
        tabIndex={0}
        role="button"
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <CircleHelp size={13} strokeWidth={2} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}

export function RealtimeKpiCard({
  label,
  icon: Icon,
  value,
  hint,
  hintLabel,
  loading,
  accent,
  onOpen,
}: RealtimeKpiCardProps) {
  // 环比色调映射到语义 CSS 变量（globals.css 单源，明暗主题自动切换）
  const changeColor =
    value.changeTone === 'good'
      ? 'var(--app-green-text)'
      : value.changeTone === 'bad'
        ? 'var(--app-red-text)'
        : 'var(--app-text-3)'
  // 强调边框：视图模型自带（保留扩展位）优先，页面按业务阈值传入的 accent 兜底
  const effectiveAccent = value.accent ?? accent
  const accentClass =
    effectiveAccent === 'danger'
      ? styles.accentDanger
      : effectiveAccent === 'warn'
        ? styles.accentWarn
        : undefined

  const body = loading ? (
    <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '40%'] }} />
  ) : (
    <>
      <div className={styles.labelRow}>
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
        {hint && hintLabel ? <KpiHint content={hint} label={hintLabel} /> : null}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value.display}</span>
      </div>
      {value.changeText ? (
        <div className={styles.changeRow} style={{ color: changeColor }}>
          {value.changeText}
        </div>
      ) : null}
    </>
  )

  if (onOpen && !loading) {
    return (
      // 整卡导航：键盘可达（Enter/Space），读屏按钮语义；导航目标由页面权限校验决定
      <section
        className={`${styles.card} ${accentClass ?? ''} ${styles.clickable}`}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
      >
        {body}
      </section>
    )
  }

  return <section className={`${styles.card} ${accentClass ?? ''}`}>{body}</section>
}
